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

import { supabase, SUPABASE_CONFIGURED } from './supabase';

const TABLE = 'analytics_events';

let queue = [];
let flushing = false;

const flushSoon = () => {
  if (flushing) return;
  flushing = true;
  setTimeout(flush, 200);
};

const flush = async () => {
  flushing = false;
  if (!SUPABASE_CONFIGURED || queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await supabase.from(TABLE).insert(batch);
  } catch (e) {
    // Re-queue on transient failure but cap at 100 so we don't grow forever.
    if (queue.length < 100) queue.unshift(...batch.slice(0, 100 - queue.length));
  }
};

/**
 * Track a named event with optional props.
 * Safe to call before login — falls back to anonUserId only.
 */
export const track = ({ event, props, userId, anonUserId } = {}) => {
  if (!event) return;
  queue.push({
    user_id: userId || null,
    anon_user_id: anonUserId || null,
    event: String(event).slice(0, 80),
    props: props ? JSON.parse(JSON.stringify(props)) : null,
  });
  flushSoon();
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
