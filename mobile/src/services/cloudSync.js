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
  'dailyGoalBonusGrantedAt',
  'quizAnswers',
  'pendingStreakRestore',
  'userWhy',
  'customGoal',
  'middayPauseCompletedAt',
  'eveningReflections',
  'tomorrowIntent',
  'eveningCloseCompletedAt',
  // NPS feedback prompt — stamps so cross-device users don't get
  // re-asked the same trigger after they already answered on phone A.
  'npsAskedAt',
  'npsScore14dAskedAt',
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
    // Quiz length: keep the higher value. Both sides should agree since
    // the lesson's quiz length is content-defined and stable, but if one
    // side is missing the field (legacy data), take the present one.
    const quizTotal = { ...(l.quizTotal || {}) };
    Object.entries(c.quizTotal || {}).forEach(([lessonId, n]) => {
      quizTotal[lessonId] = Math.max(quizTotal[lessonId] || 0, n || 0);
    });
    out[pathId] = { completed, reflections, quizCorrect, quizTotal };
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

// Merge per-question quiz answers. Each side has
//   { [lessonId]: [{ correct, attempts, lastAt }, ...] }
// Per-question, the entry with the more recent lastAt wins — that's
// the user's latest attempt and the truthful state of mastery. If only
// one side has an entry, keep it.
function mergeQuizAnswers(local = {}, cloud = {}) {
  const out = {};
  const allLessonIds = new Set([
    ...Object.keys(local),
    ...Object.keys(cloud),
  ]);
  for (const lessonId of allLessonIds) {
    const l = Array.isArray(local[lessonId]) ? local[lessonId] : [];
    const c = Array.isArray(cloud[lessonId]) ? cloud[lessonId] : [];
    const maxLen = Math.max(l.length, c.length);
    const merged = [];
    for (let i = 0; i < maxLen; i++) {
      const lv = l[i];
      const cv = c[i];
      if (!lv && !cv) continue;
      if (lv && !cv) { merged[i] = lv; continue; }
      if (cv && !lv) { merged[i] = cv; continue; }
      merged[i] = (cv.lastAt || '') > (lv.lastAt || '') ? cv : lv;
    }
    if (merged.length > 0) out[lessonId] = merged;
  }
  return out;
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
    // Daily goal bonus stamp — take the later date so a device that hasn't
    // hit the goal today doesn't grant the +50 XP bonus again after sync.
    dailyGoalBonusGrantedAt:
      (cloudPayload.dailyGoalBonusGrantedAt || '') >
      (localState.dailyGoalBonusGrantedAt || '')
        ? cloudPayload.dailyGoalBonusGrantedAt
        : localState.dailyGoalBonusGrantedAt || null,
    // Midday Pause completion stamp — same later-date-wins rule so the
    // pill on Home stays consistent across devices for the user.
    middayPauseCompletedAt:
      (cloudPayload.middayPauseCompletedAt || '') >
      (localState.middayPauseCompletedAt || '')
        ? cloudPayload.middayPauseCompletedAt
        : localState.middayPauseCompletedAt || null,
    // Evening Close completion stamp — mirrors Midday Pause merge.
    eveningCloseCompletedAt:
      (cloudPayload.eveningCloseCompletedAt || '') >
      (localState.eveningCloseCompletedAt || '')
        ? cloudPayload.eveningCloseCompletedAt
        : localState.eveningCloseCompletedAt || null,
    // NPS asked-at stamps. Take whichever side has a value — once a
    // user has answered on any device, every device honors it. If both
    // sides have a value, the earlier date wins (we asked first; any
    // later date is just a re-sync of the same one-shot event).
    npsAskedAt:
      localState.npsAskedAt && cloudPayload.npsAskedAt
        ? (localState.npsAskedAt < cloudPayload.npsAskedAt
            ? localState.npsAskedAt
            : cloudPayload.npsAskedAt)
        : localState.npsAskedAt || cloudPayload.npsAskedAt || null,
    npsScore14dAskedAt:
      localState.npsScore14dAskedAt && cloudPayload.npsScore14dAskedAt
        ? (localState.npsScore14dAskedAt < cloudPayload.npsScore14dAskedAt
            ? localState.npsScore14dAskedAt
            : cloudPayload.npsScore14dAskedAt)
        : localState.npsScore14dAskedAt || cloudPayload.npsScore14dAskedAt || null,
    // Evening reflections — multi-day map of "bugün ne öğrendin?"
    // entries. Merge per date key; the user might write on phone A
    // and edit on phone B before the first push lands. We pick the
    // cloud entry when it differs from local (cloud is, by virtue of
    // having round-tripped through the server, the more recent push
    // in the common case). Local-only keys are preserved.
    eveningReflections: mergeEveningReflections(
      localState.eveningReflections,
      cloudPayload.eveningReflections,
    ),
    // Tomorrow's intent — single object { date, intent }. The later
    // date wins; if dates match, prefer the side with the higher
    // sync recency (cloud, since it round-tripped). Equal entries
    // collapse trivially.
    tomorrowIntent: mergeTomorrowIntent(
      localState.tomorrowIntent,
      cloudPayload.tomorrowIntent,
    ),
    // Per-question quiz log (#2A). Per-question latest-wins merge so the
    // adaptive engine reads consistent answer history across devices.
    quizAnswers: mergeQuizAnswers(
      localState.quizAnswers,
      cloudPayload.quizAnswers,
    ),
    // Custom goal: take whichever side actually has one; if both, prefer the
    // side with more check-ins (more activity = truer source). Merge their
    // check-in maps so progress isn't lost on multi-device edits.
    customGoal: mergeCustomGoal(localState.customGoal, cloudPayload.customGoal),
    // Daily-challenge completion stamp — later date wins so a device that
    // already completed today doesn't re-grant the bonus on the other side.
    dailyChallengeCompletedAt:
      (cloudPayload.dailyChallengeCompletedAt || '') >
      (localState.dailyChallengeCompletedAt || '')
        ? cloudPayload.dailyChallengeCompletedAt
        : localState.dailyChallengeCompletedAt || null,
    // Daily login bonus stamp — same later-date-wins rule.
    dailyLoginGrantedAt:
      (cloudPayload.dailyLoginGrantedAt || '') >
      (localState.dailyLoginGrantedAt || '')
        ? cloudPayload.dailyLoginGrantedAt
        : localState.dailyLoginGrantedAt || null,
    // Vacation end date — keep the later one so a vacation started on one
    // device stays active on the other.
    vacationUntil:
      (cloudPayload.vacationUntil || '') > (localState.vacationUntil || '')
        ? cloudPayload.vacationUntil
        : localState.vacationUntil || null,
    // "Your Why" — prefer the newer side's text; either side's value is
    // user-authored so we never blindly drop one. Falls back to whichever
    // is non-null when only one side has it.
    userWhy: newerSide.userWhy || localState.userWhy || cloudPayload.userWhy || null,
    // Pending streak-restore window — short-lived (48h). Keep the side
    // whose expiresAt is later so a device that captured a restore offer
    // doesn't lose it on sync. Both-null collapses trivially.
    pendingStreakRestore: (() => {
      const l = localState.pendingStreakRestore;
      const c = cloudPayload.pendingStreakRestore;
      if (!l && !c) return null;
      if (!l) return c;
      if (!c) return l;
      return (c.expiresAt || '') > (l.expiresAt || '') ? c : l;
    })(),
  };
}

// Evening reflections — { 'YYYY-MM-DD': text }. Per-key cloud-wins
// (cloud is the round-tripped value, typically newer). Local-only
// keys are preserved untouched.
function mergeEveningReflections(local = {}, cloud = {}) {
  const out = { ...local };
  Object.entries(cloud || {}).forEach(([date, text]) => {
    if (typeof text === 'string' && text) {
      out[date] = text;
    }
  });
  return out;
}

// Tomorrow's intent — { date, intent }. Later-date wins; equal-date
// entries fall through to cloud (round-tripped). Empty sides collapse.
function mergeTomorrowIntent(local, cloud) {
  if (!local && !cloud) return null;
  if (!local) return cloud || null;
  if (!cloud) return local;
  const lDate = local.date || '';
  const cDate = cloud.date || '';
  if (cDate > lDate) return cloud;
  if (lDate > cDate) return local;
  // Same date — prefer cloud (it's the round-tripped value, so the
  // user's most-recent push wins ties).
  return cloud;
}

function mergeCustomGoal(local, cloud) {
  if (!local && !cloud) return null;
  if (!local) return cloud;
  if (!cloud) return local;
  // Both sides have a goal — merge check-ins, keep the side with the most
  // recent edit (createdAt-tiebreak), and union the per-day checkIn map.
  const checkIns = { ...(cloud.checkIns || {}), ...(local.checkIns || {}) };
  const localNewer = (local.createdAt || '') >= (cloud.createdAt || '');
  const winner = localNewer ? local : cloud;
  const lastCheckInDate =
    (local.lastCheckInDate || '') > (cloud.lastCheckInDate || '')
      ? local.lastCheckInDate
      : cloud.lastCheckInDate || null;
  return {
    text: winner.text,
    targetDays: winner.targetDays,
    createdAt: winner.createdAt,
    checkIns,
    lastCheckInDate,
  };
}

/**
 * @deprecated Kept for backwards compatibility — callers should switch to
 * `mergeStates` and always dispatch the result. This shim still works because
 * the merged payload is, by design, a superset of either side.
 */
export const chooseWinner = mergeStates;
