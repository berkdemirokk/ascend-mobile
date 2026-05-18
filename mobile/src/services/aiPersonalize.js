// AI Personalization Layer (Layer B) — adds a stoic per-user intro before
// lesson teaching and a stoic acknowledgement after the reflection. Both
// calls are CACHED hard per (userId, lessonId, type) so a re-open never
// double-bills, AsyncStorage-backed so a cold restart doesn't either.
//
// Failure mode: every public function returns null on any failure (no key,
// missing input, timeout, non-2xx, parse error, day-cap hit). The caller
// renders nothing on null — the AI overlay is purely additive.
//
// Cost guardrails:
//   - In-memory cache + AsyncStorage persistence keyed by (userId, lessonId, type)
//   - Hard cap: 10 successful API calls per user per local day
//   - Per-call timeout: 5s (AbortController). After 5s → null, no retry.
//   - Failed calls don't retry. The reducer's cache write only happens on success
//     so a transient network blip leaves the slot open for a real retry later.
//
// Token cost target: ~$0.005/call × 2 calls/lesson × 3 lessons/day = $0.03/day.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Feature flag — single switch that disables the entire AI layer. When
// false: the public generate* functions short-circuit to null, the
// Settings toggle is hidden, and aiPersonalizeActive resolves to false
// regardless of stored user preference. Flip to `true` to re-enable
// the feature once we're ready to ship it. Cost / API-key concerns are
// the reason it ships disabled in 1.0.20.
export const AI_PERSONALIZE_FEATURE_ENABLED = false;

// Storage keys ----------------------------------------------------------------
const CACHE_KEY = '@ascend/ai_personalize_cache_v1';
// Day-cap counter — { 'YYYY-MM-DD': { [userId]: number } } persisted so
// cold restarts don't reset the user's budget mid-day.
const DAILY_COUNTER_KEY = '@ascend/ai_personalize_daily_v1';

// API config ------------------------------------------------------------------
// Anthropic doesn't ship an RN-friendly SDK; raw fetch is the right tool.
// Key is read from app.json:extra.anthropicApiKey (preferred) or the
// ANTHROPIC_API_KEY env var (set via expo env) as a fallback for CI.
const API_KEY =
  Constants?.expoConfig?.extra?.anthropicApiKey ||
  process.env.ANTHROPIC_API_KEY ||
  '';
// Current Sonnet 4.5 at the time of writing. Bump this when 4.7 ships.
const MODEL = 'claude-sonnet-4-5-20251022';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const PER_CALL_TIMEOUT_MS = 5000;
const DAILY_HARD_CAP = 10;

// --- In-memory cache ---------------------------------------------------------
// Mirrors AsyncStorage so the second hit within a session is instant.
// Shape: { 'userId::lessonId::type': 'cached response string' }
let memCache = null;
let memCacheHydrated = false;

const cacheKey = (userId, lessonId, type) =>
  `${userId || 'anon'}::${lessonId || 'unknown'}::${type}`;

async function hydrateCache() {
  if (memCacheHydrated) return;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    memCache = raw ? JSON.parse(raw) : {};
  } catch {
    memCache = {};
  }
  memCacheHydrated = true;
}

async function readCached(userId, lessonId, type) {
  await hydrateCache();
  const v = memCache[cacheKey(userId, lessonId, type)];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

async function writeCached(userId, lessonId, type, value) {
  await hydrateCache();
  memCache[cacheKey(userId, lessonId, type)] = value;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(memCache));
  } catch {
    // Best-effort. The in-memory copy still serves the session.
  }
}

// --- Daily counter (hard cap) ------------------------------------------------
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

async function readDailyCount(userId) {
  try {
    const raw = await AsyncStorage.getItem(DAILY_COUNTER_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return all?.[todayKey()]?.[userId || 'anon'] || 0;
  } catch {
    return 0;
  }
}

async function bumpDailyCount(userId) {
  try {
    const raw = await AsyncStorage.getItem(DAILY_COUNTER_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const tk = todayKey();
    // Drop yesterday's bucket so the file never grows unbounded.
    const next = { [tk]: { ...(all[tk] || {}) } };
    const u = userId || 'anon';
    next[tk][u] = (next[tk][u] || 0) + 1;
    await AsyncStorage.setItem(DAILY_COUNTER_KEY, JSON.stringify(next));
    return next[tk][u];
  } catch {
    return 0;
  }
}

// --- Anthropic call ----------------------------------------------------------
async function callClaude({ system, user, maxTokens }) {
  if (!API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        // Required for direct browser/RN calls. Anthropic still recommends
        // a server proxy long-term, but this unblocks the client-only MVP.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Anthropic messages API returns { content: [{ type: 'text', text: '...' }] }
    const text =
      Array.isArray(json?.content) && json.content[0]?.type === 'text'
        ? String(json.content[0].text || '').trim()
        : '';
    return text || null;
  } catch {
    // AbortError, network, parse — all map to null. Caller silently skips.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// --- Prompt builders ---------------------------------------------------------
// Centralized so both call sites use the same brand voice. Locale defaults
// to Turkish (the app's home language); the caller can override for EN
// users so the AI matches the UI language.
function introPrompt({ userName, lessonTitle, pathId, customGoal, recentReflection, locale }) {
  const lang = locale === 'en' ? 'English' : 'Turkish';
  const goal =
    typeof customGoal === 'string' && customGoal.trim().length > 0
      ? customGoal.trim().slice(0, 200)
      : '';
  const reflection =
    typeof recentReflection === 'string' && recentReflection.trim().length > 0
      ? recentReflection.trim().slice(0, 240)
      : '';

  const system =
    `You are a stoic discipline coach inside the Ascend: Monk Mode app. ` +
    `Voice: masculine, direct, austere. No praise. No emojis. No hedging. ` +
    `No platitudes. Speak to the user by first name. Write in ${lang}. ` +
    `Exactly 2 sentences, ~30 words total. Do not exceed.`;

  const user =
    `User: ${userName || 'Friend'}\n` +
    `Lesson: "${lessonTitle}"\n` +
    `Path: ${pathId}\n` +
    `Their declared goal: ${goal || '(none stated)'}\n` +
    `Their most recent reflection: ${reflection || '(none yet)'}\n\n` +
    `Write a 2-sentence personalized intro tying THIS lesson to THEIR situation. ` +
    `Reference their goal or reflection if relevant. End sharp.`;

  return { system, user };
}

function reflectionPrompt({ userName, userReflection, lessonTitle, locale }) {
  const lang = locale === 'en' ? 'English' : 'Turkish';
  const reflection =
    typeof userReflection === 'string' ? userReflection.trim().slice(0, 600) : '';

  const system =
    `You are a stoic sage inside the Ascend: Monk Mode app. ` +
    `Voice: stoic, direct, austere. No praise. No emojis. No congratulations. ` +
    `No motivational fluff. Acknowledge briefly, then provoke deeper thought. ` +
    `Address the user by first name when natural. Write in ${lang}. ` +
    `1-2 sentences total, ~25 words. Do not exceed.`;

  const user =
    `User: ${userName || 'Friend'}\n` +
    `Lesson: "${lessonTitle}"\n` +
    `Their reflection: "${reflection}"\n\n` +
    `Respond with 1-2 sentences: brief stoic acknowledgement, then a single ` +
    `targeted question that pushes them to think one layer deeper about what ` +
    `they wrote. Don't praise. Don't restate. Ask, don't lecture.`;

  return { system, user };
}

// --- Public API --------------------------------------------------------------

/**
 * Generate the lesson-intro overlay. Cached by (userId, lessonId, 'intro').
 *
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.lessonId
 * @param {string} args.lessonTitle
 * @param {string} args.pathId
 * @param {string} [args.userName]
 * @param {string} [args.customGoal]      free-text user goal (optional)
 * @param {string} [args.recentReflection] their last journal entry (optional)
 * @param {string} [args.locale]          'tr' (default) or 'en'
 * @returns {Promise<string|null>}        intro text, or null on any failure
 */
export async function generateLessonIntro({
  userId,
  lessonId,
  lessonTitle,
  pathId,
  userName,
  customGoal,
  recentReflection,
  locale,
}) {
  if (!lessonId || !lessonTitle) return null;

  // 0. Feature flag — disabled = no-op. Skips even the cache read so
  //    a previously-cached response from a brief-enable window doesn't
  //    leak through after we turn it off.
  if (!AI_PERSONALIZE_FEATURE_ENABLED) return null;

  // 1. Cache hit — instant return, no spend.
  const cached = await readCached(userId, lessonId, 'intro');
  if (cached) return cached;

  // 2. No key configured — fail silently (caller renders nothing).
  if (!API_KEY) return null;

  // 3. Daily hard cap. Counter is bumped BEFORE the call so an in-flight
  //    failure still counts against the budget (prevents thrash on repeated
  //    failures eating into nothing). Tiny over/undershoot is acceptable.
  const used = await readDailyCount(userId);
  if (used >= DAILY_HARD_CAP) return null;
  await bumpDailyCount(userId);

  const { system, user } = introPrompt({
    userName,
    lessonTitle,
    pathId,
    customGoal,
    recentReflection,
    locale,
  });

  const text = await callClaude({ system, user, maxTokens: 120 });
  if (!text) return null;

  // 4. Persist on success only — failed slots stay open for a future retry
  //    (e.g. the user closes the lesson without finishing and reopens).
  await writeCached(userId, lessonId, 'intro', text);
  return text;
}

/**
 * Generate the post-reflection sage response. Cached by (userId, lessonId, 'reflect').
 *
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.lessonId
 * @param {string} args.userReflection  the user's reflection text
 * @param {string} args.lessonTitle
 * @param {string} [args.userName]
 * @param {string} [args.locale]
 * @returns {Promise<string|null>}      response text, or null on any failure
 */
export async function generateReflectionResponse({
  userId,
  lessonId,
  userReflection,
  lessonTitle,
  userName,
  locale,
}) {
  if (!lessonId || !lessonTitle) return null;
  // Feature flag — disabled = no-op (see generatePersonalizedIntro).
  if (!AI_PERSONALIZE_FEATURE_ENABLED) return null;
  const trimmed =
    typeof userReflection === 'string' ? userReflection.trim() : '';
  // No reflection text → nothing meaningful to respond to.
  if (trimmed.length < 4) return null;

  const cached = await readCached(userId, lessonId, 'reflect');
  if (cached) return cached;

  if (!API_KEY) return null;

  const used = await readDailyCount(userId);
  if (used >= DAILY_HARD_CAP) return null;
  await bumpDailyCount(userId);

  const { system, user } = reflectionPrompt({
    userName,
    userReflection: trimmed,
    lessonTitle,
    locale,
  });

  const text = await callClaude({ system, user, maxTokens: 100 });
  if (!text) return null;

  await writeCached(userId, lessonId, 'reflect', text);
  return text;
}

// Test/dev helpers — not exported by default surface area. Only the two
// generate* functions are part of the public contract.
export const __test__ = {
  cacheKey,
  introPrompt,
  reflectionPrompt,
  DAILY_HARD_CAP,
  PER_CALL_TIMEOUT_MS,
};
