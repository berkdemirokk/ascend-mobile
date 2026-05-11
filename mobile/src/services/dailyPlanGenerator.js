// Daily Plan Generator — premium-only "smart coach" that builds a
// 3-lesson session for the day based on the user's signals: mood
// (today's check-in OR onboarding default), goal (onboarding OR
// reflection-derived), and current path progress.
//
// Why this is the premium killer feature:
//   - Free users browse 5 paths and pick a lesson manually (decision
//     fatigue).
//   - Premium users tap "Generate Today's Plan" → app picks 3 lessons
//     curated for THEM → chained 15-min session → done.
//   - Premium qualitatively different, not just no-ads.

import { PATHS, getPathLessons, getLessonState } from '../data/paths';

const GOAL_PRIMARY_PATH = {
  focus: 'mind-discipline',
  morning: 'silent-morning',
  fitness: 'body-discipline',
  money: 'money-discipline',
  discipline: 'dopamine-detox',
};

const REFLECTION_TO_PATH = {
  detox: 'dopamine-detox',
  body: 'body-discipline',
  mind: 'mind-discipline',
  money: 'money-discipline',
};

const MOOD_INTENSITY = {
  motivated: 'deep',   // pick the next uncompleted lesson (full curriculum)
  fresh: 'standard',   // standard pick
  lost: 'gentle',      // prefer earlier-stage lessons or review existing
};

/**
 * Build today's recommended lesson plan.
 *
 * @param {Object} ctx
 * @param {Object} ctx.pathProgress  user's path progress map
 * @param {string} [ctx.activePathId]
 * @param {string} [ctx.goal]              from onboarding userProfile.answers.goal
 * @param {string} [ctx.reflectionDominant] from reflectionSignals.dominant
 * @param {string} [ctx.mood]              today's mood or onboarding mood
 * @returns {Array<{ pathId, lessonId, reason }>}  exactly 3 entries (or fewer if curriculum exhausted)
 */
export const generateDailyPlan = (ctx = {}) => {
  const { pathProgress = {}, activePathId, goal, reflectionDominant, mood } = ctx;

  // Priority-ordered candidate paths (most-relevant first). Each entry
  // gets a "reason" tag so the UI can explain WHY this lesson is the
  // pick — that's the magic moment: "Oh, the app knows me."
  const candidates = [];

  // 1. Active path — user's current focus. Almost always wins slot 1.
  if (activePathId) {
    candidates.push({ pathId: activePathId, reason: 'active' });
  }

  // 2. Reflection-derived path — lived behavior overrides stated goal.
  if (reflectionDominant && REFLECTION_TO_PATH[reflectionDominant]) {
    const reflPath = REFLECTION_TO_PATH[reflectionDominant];
    if (!candidates.find((c) => c.pathId === reflPath)) {
      candidates.push({ pathId: reflPath, reason: 'reflection' });
    }
  }

  // 3. Goal-derived path — onboarding stated intent.
  if (goal && GOAL_PRIMARY_PATH[goal]) {
    const goalPath = GOAL_PRIMARY_PATH[goal];
    if (!candidates.find((c) => c.pathId === goalPath)) {
      candidates.push({ pathId: goalPath, reason: 'goal' });
    }
  }

  // 4. Fill remaining slots with non-completed paths so the plan
  // always has 3 entries (variety beats monotony).
  for (const p of PATHS) {
    if (candidates.length >= 5) break;
    if (candidates.find((c) => c.pathId === p.id)) continue;
    candidates.push({ pathId: p.id, reason: 'variety' });
  }

  // Now pick the next uncompleted lesson from each candidate path.
  // mood='gentle' optionally shifts toward the same path's earlier
  // lessons (review feel) — not implemented yet, keep TODO.
  const plan = [];
  for (const { pathId, reason } of candidates) {
    if (plan.length >= 3) break;
    const path = PATHS.find((p) => p.id === pathId);
    if (!path) continue;
    const lessons = getPathLessons(path);
    const nextLesson = lessons.find(
      (l) => getLessonState(l, pathProgress) !== 'completed',
    );
    if (!nextLesson) continue; // path fully done — skip
    plan.push({
      pathId,
      lessonId: nextLesson.id,
      lessonOrder: nextLesson.order,
      reason,
    });
  }

  return plan;
};

/**
 * Reason → i18n key. Used by DailyPlanCard to label each lesson row.
 */
export const reasonKey = (reason) => {
  switch (reason) {
    case 'active': return 'dailyPlan.reasonActive';
    case 'reflection': return 'dailyPlan.reasonReflection';
    case 'goal': return 'dailyPlan.reasonGoal';
    case 'variety': return 'dailyPlan.reasonVariety';
    default: return 'dailyPlan.reasonGeneric';
  }
};
