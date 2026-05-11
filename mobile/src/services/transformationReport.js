// Transformation Report — derives "you have grown" insights purely
// from the data the app already collects (lessonHistory, pathProgress,
// reflections, mood check-ins, streak, install date). No HealthKit, no
// network, no AI calls — just smart aggregation of what we know.
//
// This is the "proof the app worked" surface. After 30 days a user
// who feels like they've "just been opening the app" sees a concrete
// list of what they actually did. That's the retention magnet that
// turns "I might stop" into "I can't stop now — look how far I've come".
//
// Public API:
//   buildTransformationReport(state)  → ReportData object
//   reportEligible(state)             → boolean (≥10 lessons + ≥7 days)

import { collectReflectionTexts, analyzeReflections } from './reflectionSignals';

/** Should we show the user a Transformation Report at all? */
export const reportEligible = (state) => {
  if (!state) return false;
  const lessonsTotal = Object.values(state.pathProgress || {}).reduce(
    (s, p) => s + (p?.completed?.length || 0),
    0,
  );
  // Need at least 10 lessons + 7 days of data — below that the report
  // is just noise / unflattering ("you wrote 12 words"). Wait for real
  // signal before surfacing the feature.
  if (lessonsTotal < 10) return false;
  const installedMs = new Date(state.installedAt || 0).getTime();
  if (!installedMs || Number.isNaN(installedMs)) return false;
  const daysSinceInstall = (Date.now() - installedMs) / (24 * 60 * 60 * 1000);
  return daysSinceInstall >= 7;
};

/**
 * Build the full transformation report.
 * @param {Object} state  the AppContext state (or a slice that has
 *   pathProgress, lessonHistory, currentStreak, longestStreak,
 *   userProfile, dailyMoodCheckInValue, installedAt).
 */
export const buildTransformationReport = (state) => {
  if (!state) return null;

  // ── Lessons & time-on-task ─────────────────────────────────────────
  const lessonsTotal = Object.values(state.pathProgress || {}).reduce(
    (s, p) => s + (p?.completed?.length || 0),
    0,
  );
  // Each lesson is roughly 5 minutes of disciplined attention.
  const minutesOfDiscipline = lessonsTotal * 5;
  const hoursOfDiscipline = Math.round(minutesOfDiscipline / 60 * 10) / 10;

  // ── Active days from lessonHistory ─────────────────────────────────
  const lessonHistory = state.lessonHistory || {};
  const activeDays = Object.keys(lessonHistory).filter(
    (k) => (lessonHistory[k] || 0) > 0,
  ).length;

  // ── Most-active hour bucket ────────────────────────────────────────
  // We don't currently log lesson completion timestamps with HOUR
  // granularity (lessonHistory is date-keyed only). For now we infer
  // a "you're a morning / evening person" tag from a simple heuristic:
  // if the user has done a comeback after dormancy frequently → night
  // owl; otherwise default to morning. (Future: log hour-of-day.)
  // Stub for now — we'll surface this only when we have the data.
  const activeHourLabel = null;

  // ── Reflections — total word count + dominant topic ────────────────
  const reflectionTexts = collectReflectionTexts(state.pathProgress);
  const totalReflectionWords = reflectionTexts.reduce(
    (s, txt) => s + (String(txt || '').trim().split(/\s+/).length),
    0,
  );
  const reflectionWeights = analyzeReflections(reflectionTexts);
  const topReflectionTopics = Object.entries(reflectionWeights || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  // ── Path completion deltas ─────────────────────────────────────────
  // For each path: how many done / how many total. Picks the top 3 by
  // completion count.
  const pathStats = Object.entries(state.pathProgress || {})
    .map(([pathId, p]) => ({
      pathId,
      completed: p?.completed?.length || 0,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 3);

  // ── Mood shift ─────────────────────────────────────────────────────
  // We have onboarding mood (state.userProfile.answers.mood) and the
  // most recent daily check-in (state.dailyMoodCheckInValue). When
  // they differ, frame as a transformation; when the same, frame as
  // continuity.
  const onboardingMood = state.userProfile?.answers?.mood || null;
  const recentMood = state.dailyMoodCheckInValue || null;
  const moodShifted =
    onboardingMood && recentMood && onboardingMood !== recentMood;

  // ── Streak narrative ──────────────────────────────────────────────
  const currentStreak = state.currentStreak || 0;
  const longestStreak = state.longestStreak || 0;

  return {
    // Core counts
    lessonsTotal,
    activeDays,
    minutesOfDiscipline,
    hoursOfDiscipline,

    // Streak
    currentStreak,
    longestStreak,

    // Path progress
    pathStats,

    // Reflections
    totalReflectionWords,
    topReflectionTopics,

    // Mood
    onboardingMood,
    recentMood,
    moodShifted,

    // Time-of-day inference (TODO — needs hour granularity in logs)
    activeHourLabel,
  };
};
