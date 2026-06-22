// Lightweight analytics + crash reporter that writes events to a Supabase
// table. This is a stop-gap until we wire up Sentry / Mixpanel proper —
// gives us first-day visibility into user behavior without a new native
// module + EAS rebuild + ASC privacy-form revision.
//
// Schema (run in Supabase SQL editor):
//   create table public.analytics_events (
//     id           uuid primary key default gen_random_uuid(),
//     user_id      uuid references auth.users(id) on delete cascade,
//     anon_user_id text,
//     event        text not null,
//     props        jsonb,
//     created_at   timestamptz not null default now()
//   );
//   alter table public.analytics_events enable row level security;
//   create policy "events: insert own"
//     on public.analytics_events for insert
//     with check (auth.uid() = user_id or user_id is null);
//
// PII rule: events here NEVER include the real name, email, or anything
// that could re-identify the user. Use anon_user_id (the ascender_<digits>
// handle) for cohort analysis.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase, SUPABASE_CONFIGURED } from './supabase';

const TABLE = 'analytics_events';
const QUEUE_STORAGE_KEY = '@ascend/analytics_queue_v1';
const MAX_QUEUE_SIZE = 100;

let queue = [];
let flushTimer = null;
let flushPromise = null;
let hydratePromise = null;
let hydrated = false;

const persistQueue = () => {
  if (!hydrated) return;
  AsyncStorage.setItem(
    QUEUE_STORAGE_KEY,
    JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)),
  ).catch(() => {});
};

const hydrateQueue = async () => {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      if (Array.isArray(stored) && stored.length) {
        queue = [...stored, ...queue].slice(-MAX_QUEUE_SIZE);
      }
    } catch {}
    hydrated = true;
    persistQueue();
  })();
  return hydratePromise;
};

const flushSoon = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAnalytics().catch(() => {});
  }, 200);
};

export const flushAnalytics = async () => {
  await hydrateQueue();
  if (!SUPABASE_CONFIGURED || queue.length === 0) return false;
  if (flushPromise) return flushPromise;
  const batch = queue.splice(0, queue.length);
  persistQueue();
  flushPromise = (async () => {
    let succeeded = false;
    try {
      const { error } = await supabase.from(TABLE).insert(batch);
      if (error) throw error;
      succeeded = true;
      persistQueue();
      return true;
    } catch {
      queue = [...batch, ...queue].slice(-MAX_QUEUE_SIZE);
      persistQueue();
      return false;
    } finally {
      flushPromise = null;
      if (succeeded && queue.length) flushSoon();
    }
  })();
  return flushPromise;
};

/**
 * Track a named event with optional props.
 * Safe to call before login — falls back to anonUserId only.
 */
export const track = ({ event, props, userId, anonUserId } = {}) => {
  if (!event) return;
  let safeProps = null;
  try {
    safeProps = props ? JSON.parse(JSON.stringify(props)) : {};
  } catch {
    safeProps = { serializationFailed: true };
  }
  queue.push({
    user_id: userId || null,
    anon_user_id: anonUserId || null,
    event: String(event).slice(0, 80),
    props: {
      ...safeProps,
      appVersion: Constants.expoConfig?.version || null,
      buildVersion: Constants.nativeBuildVersion || null,
      platform: Platform.OS,
    },
  });
  queue = queue.slice(-MAX_QUEUE_SIZE);
  persistQueue();
  hydrateQueue().finally(flushSoon);
};

/**
 * Log a JS error (from ErrorBoundary or a try/catch). Stores stack trace
 * truncated at 4KB so we don't blow up the row limit.
 */
export const logError = ({ error, source, userId, anonUserId } = {}) => {
  if (!error) return;
  const message = String(error?.message || error).slice(0, 500);
  const stack = String(error?.stack || '').slice(0, 4000);
  track({
    event: 'js_error',
    props: { source: source || 'unknown', message, stack },
    userId,
    anonUserId,
  });
};

let removeGlobalErrorHandler = null;

export const installGlobalErrorHandler = () => {
  if (removeGlobalErrorHandler) return removeGlobalErrorHandler;
  const errorUtils = globalThis?.ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
    return () => {};
  }
  const previousHandler = errorUtils.getGlobalHandler();
  const handler = (error, isFatal) => {
    try {
      logError({
        error,
        source: isFatal ? 'global_fatal' : 'global_nonfatal',
      });
    } catch {}
    previousHandler?.(error, isFatal);
  };
  errorUtils.setGlobalHandler(handler);
  removeGlobalErrorHandler = () => {
    errorUtils.setGlobalHandler(previousHandler);
    removeGlobalErrorHandler = null;
  };
  return removeGlobalErrorHandler;
};
