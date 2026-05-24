import { supabase, SUPABASE_CONFIGURED } from './supabase';

const TABLE = 'user_state';

// Fields persisted to cloud. Skip transient/UI/premium (premium = store-authoritative).
const SYNCED_KEYS = [
  'onboarded',
  'userProfile',
  'totalXP',
  'level',
  'currentStreak',
  'longestStreak',
  'lastCompletedDate',
  'streakFreezes',
  'unlockedAchievements',
  'hearts',
  'heartsRefillAt',
  'pathProgress',
  'activePathId',
  'lessonHistory',
  'anonUsername',
  'vacationUntil',
  'dailyChallengeCompletedAt',
  'dailyLoginGrantedAt',
  'pathPledges',
  'baselineAssessment',
  'assessmentHistory',
  'latestAssessment',
  'dailyDeckHistory',
  'lastDailyDeckCompletedDate',
  // Added after audit found these were being pushed without merge,
  // causing multi-device drift (letter cooldown wrong, repair count
  // reset, momentum session phantom on second device).
  'streakRepairsUsed',
  'todaySessionLessons',
  'lastLessonAtMs',
];

export function pickSyncableState(state) {
  const out = {};
  for (const k of SYNCED_KEYS) {
    if (state[k] !== undefined) out[k] = state[k];
  }
  return out;
}

/**
 * Pull the user's cloud state. Returns the payload object or null.
 */
export async function pullState(userId) {
  if (!SUPABASE_CONFIGURED) return null;
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('payload, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[cloudSync] pull error:', error.message);
      return null;
    }
    return data?.payload || null;
  } catch (e) {
    console.warn('[cloudSync] pull exception:', e?.message);
    return null;
  }
}

/**
 * Push a state snapshot. Upsert single row per user.
 */
export async function pushState(userId, state) {
  if (!SUPABASE_CONFIGURED) return null;
  if (!userId) return null;
  try {
    const payload = pickSyncableState(state);
    const { error } = await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      console.warn('[cloudSync] push error:', error.message);
    }
    return error;
  } catch (e) {
    console.warn('[cloudSync] push exception:', e?.message);
    return e;
  }
}

// ── Merge ────────────────────────────────────────────────────────────────────
//
// Earlier versions of this file picked a single "winner" between local and
// cloud. That dropped progress made on a second device when the first device
// happened to have one more completed lesson on a different path. We now merge
// per-path so that completing lesson 5 of "mind-discipline" on phone A and
// lesson 3 of "body-discipline" on phone B never overwrites either side.

function mergePathProgress(local = {}, cloud = {}) {
  const out = {};
  const allPathIds = new Set([...Object.keys(local), ...Object.keys(cloud)]);
  for (const pathId of allPathIds) {
    const l = local[pathId] || { completed: [], reflections: {}, quizCorrect: {} };
    const c = cloud[pathId] || { completed: [], reflections: {}, quizCorrect: {} };
    const completed = Array.from(new Set([...(l.completed || []), ...(c.completed || [])]));
    // Reflections: prefer cloud when both sides wrote different text — assume
    // cloud is from a later push. Local-only reflections are kept untouched.
    const reflections = { ...(l.reflections || {}), ...(c.reflections || {}) };
    // Quiz correctness: keep the higher score.
    const quizCorrect = { ...(l.quizCorrect || {}) };
    Object.entries(c.quizCorrect || {}).forEach(([lessonId, n]) => {
      quizCorrect[lessonId] = Math.max(quizCorrect[lessonId] || 0, n || 0);
    });
    out[pathId] = { completed, reflections, quizCorrect };
  }
  return out;
}

function mergeLessonHistory(local = {}, cloud = {}) {
  const out = { ...local };
  Object.entries(cloud).forEach(([date, n]) => {
    out[date] = Math.max(out[date] || 0, n || 0);
  });
  return out;
}

// Merge two per-path-pledge maps. Newer pledge per pathId wins. No
// timestamp on individual pledges so we use cloud-side when both have
// a value (cloud is typically the most recent push from any device).
function mergePathPledges(local = {}, cloud = {}) {
  const out = {};
  const ids = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
  for (const id of ids) {
    out[id] = cloud[id] || local[id] || undefined;
  }
  return out;
}

// Concatenate two append-only history arrays (assessments, decks),
// dedupe by timestamp, keep newest 60. Both inputs may be undefined.
function mergeTimeOrderedHistory(local = [], cloud = [], keep = 60) {
  const seen = new Set();
  const all = [...(local || []), ...(cloud || [])]
    .filter((e) => e && e.ts)
    .filter((e) => {
      if (seen.has(e.ts)) return false;
      seen.add(e.ts);
      return true;
    })
    .sort((a, b) => a.ts - b.ts);
  return all.slice(-keep);
}

// Pick whichever side has the bigger timestamp (or string date).
function maxValue(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return a >= b ? a : b;
}

function pickNewer(localDate, cloudDate) {
  return (cloudDate || '') > (localDate || '') ? 'cloud' : 'local';
}

/**
 * Merge local and cloud state into a single conflict-free snapshot.
 * Both inputs may be partial. Returns the merged payload — never null when
 * `local` is a valid object.
 */
export function mergeStates(localState, cloudPayload) {
  if (!cloudPayload) return localState;

  const newer = pickNewer(localState.lastCompletedDate, cloudPayload.lastCompletedDate);
  const newerSide = newer === 'cloud' ? cloudPayload : localState;

  return {
    onboarded: !!(localState.onboarded || cloudPayload.onboarded),
    // Prefer the newer side's profile if it's non-empty; else fall back.
    userProfile:
      newerSide.userProfile && Object.keys(newerSide.userProfile).length > 0
        ? newerSide.userProfile
        : cloudPayload.userProfile || localState.userProfile || null,
    totalXP: Math.max(localState.totalXP || 0, cloudPayload.totalXP || 0),
    level: Math.max(localState.level || 1, cloudPayload.level || 1),
    // Streak: take the side with the more recent lastCompletedDate; their
    // count is authoritative because streak only advances on a completion.
    currentStreak: newerSide.currentStreak || 0,
    longestStreak: Math.max(
      localState.longestStreak || 0,
      cloudPayload.longestStreak || 0,
    ),
    lastCompletedDate:
      (cloudPayload.lastCompletedDate || '') > (localState.lastCompletedDate || '')
        ? cloudPayload.lastCompletedDate
        : localState.lastCompletedDate || null,
    streakFreezes: Math.max(
      localState.streakFreezes || 0,
      cloudPayload.streakFreezes || 0,
    ),
    unlockedAchievements: Array.from(
      new Set([
        ...(localState.unlockedAchievements || []),
        ...(cloudPayload.unlockedAchievements || []),
      ]),
    ),
    // Hearts: take the more recent side's number — hearts decay over time
    // and the newer client has the truer state. RefillAt is whichever is
    // furthest in the future (so we don't grant a free refill).
    hearts: newerSide.hearts ?? 5,
    heartsRefillAt:
      (cloudPayload.heartsRefillAt || '') > (localState.heartsRefillAt || '')
        ? cloudPayload.heartsRefillAt
        : localState.heartsRefillAt || null,
    pathProgress: mergePathProgress(localState.pathProgress, cloudPayload.pathProgress),
    activePathId: newerSide.activePathId || localState.activePathId || cloudPayload.activePathId,
    lessonHistory: mergeLessonHistory(localState.lessonHistory, cloudPayload.lessonHistory),
    // Anon username is sticky — once a device generated one, keep it. If both
    // sides have a value, the local one wins so users don't get re-handled
    // when they install on a second device that hadn't generated yet.
    anonUsername: localState.anonUsername || cloudPayload.anonUsername || null,
    // ── Added in the post-audit merge expansion ─────────────────────────
    // Without these, the merged payload would silently drop any new
    // state fields, wiping device-B's pledges/assessments/decks on
    // every sign-in. We previously lost ~9 fields this way.
    vacationUntil: maxValue(localState.vacationUntil, cloudPayload.vacationUntil),
    dailyChallengeCompletedAt: maxValue(
      localState.dailyChallengeCompletedAt,
      cloudPayload.dailyChallengeCompletedAt,
    ),
    dailyLoginGrantedAt: maxValue(
      localState.dailyLoginGrantedAt,
      cloudPayload.dailyLoginGrantedAt,
    ),
    pathPledges: mergePathPledges(localState.pathPledges, cloudPayload.pathPledges),
    // Baseline assessment is one-shot — keep the EARLIEST one seen on
    // either side. The user's first install established their starting
    // point; we never overwrite it.
    baselineAssessment: (() => {
      const l = localState.baselineAssessment;
      const c = cloudPayload.baselineAssessment;
      if (!l) return c || null;
      if (!c) return l;
      return (l.ts || 0) <= (c.ts || 0) ? l : c;
    })(),
    assessmentHistory: mergeTimeOrderedHistory(
      localState.assessmentHistory,
      cloudPayload.assessmentHistory,
      12,
    ),
    // latestAssessment is derived from history but we still merge in
    // case one side has only this denormalised pointer.
    latestAssessment: (() => {
      const merged = mergeTimeOrderedHistory(
        localState.assessmentHistory,
        cloudPayload.assessmentHistory,
        12,
      );
      if (merged.length > 0) return merged[merged.length - 1];
      return (
        newerSide.latestAssessment ||
        localState.latestAssessment ||
        cloudPayload.latestAssessment ||
        null
      );
    })(),
    dailyDeckHistory: mergeTimeOrderedHistory(
      localState.dailyDeckHistory,
      cloudPayload.dailyDeckHistory,
      60,
    ),
    lastDailyDeckCompletedDate: maxValue(
      localState.lastDailyDeckCompletedDate,
      cloudPayload.lastDailyDeckCompletedDate,
    ),
    // Counter fields — keep the bigger number.
    streakRepairsUsed: Math.max(
      localState.streakRepairsUsed || 0,
      cloudPayload.streakRepairsUsed || 0,
    ),
    // Momentum window — newer side wins. Stale value from old cloud
    // doesn't matter because reducer guard checks SESSION_TIMEOUT_MS.
    todaySessionLessons: newerSide.todaySessionLessons || 0,
    lastLessonAtMs: Math.max(
      localState.lastLessonAtMs || 0,
      cloudPayload.lastLessonAtMs || 0,
    ),
    // installedAt — prefer the OLDEST timestamp. Without this, a user
    // installing on a 2nd device today gets the LOAD_STATE-fixup
    // logic in AppContext picking today's date, then turning the
    // first-24h grace period back on for an already-experienced user.
    // The oldest install is the authoritative "I started using this"
    // moment regardless of which device they're on now.
    installedAt: (() => {
      const l = localState.installedAt;
      const c = cloudPayload.installedAt;
      if (!l) return c || null;
      if (!c) return l;
      // ISO timestamp string compare is lexicographic-safe ascending.
      return l <= c ? l : c;
    })(),
  };
}

/**
 * @deprecated Kept for backwards compatibility — callers should switch to
 * `mergeStates` and always dispatch the result. This shim still works because
 * the merged payload is, by design, a superset of either side.
 */
export const chooseWinner = mergeStates;
