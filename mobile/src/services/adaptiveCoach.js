// Adaptive Coach — surfaces "you're crushing it / take it slow" nudges
// based on rolling quiz performance. The lesson sequence itself is
// content-defined and we don't reorder it (would break path narrative),
// but we DO use real performance signals to:
//
//   1. Surface a "you're mastering this — try [harder path]" nudge
//      when the user is sailing through with high accuracy.
//   2. Surface a "review the basics" nudge when the user is grinding
//      with low accuracy on the current path — instead of letting
//      them quietly disengage.
//
// Stays as a soft suggestion, never blocks lesson access. The user is
// always in control; the coach just whispers.
//
// Returns null when no signal is strong enough (too few lessons, or
// mixed performance). Callers should hide the banner on null.

import { PATHS, getPathById } from '../data/paths';

// Minimum lessons completed before any suggestion fires. Below this,
// the signal is too noisy to be useful.
const MIN_LESSONS_FOR_SIGNAL = 5;

// How many most-recent lessons we average for the "rolling" accuracy.
// Short enough to react quickly when the user picks up steam (or
// struggles), long enough to filter out one-off lucky/unlucky rounds.
const ROLLING_WINDOW = 5;

// Thresholds for the two suggestion modes.
const MASTERY_THRESHOLD = 0.85;   // ≥ 85% rolling accuracy → "challenge up"
const STRUGGLE_THRESHOLD = 0.45;  // ≤ 45% rolling accuracy → "slow down"

/**
 * Compute a suggestion based on pathProgress quiz accuracy + the active
 * path. Returns one of:
 *
 *   { kind: 'mastery', accuracy, suggestPathId }
 *   { kind: 'struggle', accuracy, currentPathId }
 *   null
 *
 * @param {Object} ctx
 * @param {Object} ctx.pathProgress  AppContext.pathProgress map
 * @param {string} ctx.activePathId  currently active path
 * @param {boolean} ctx.isPremium    used to skip premium-locked suggestions
 */
export function getAdaptiveSuggestion({ pathProgress, activePathId, isPremium }) {
  if (!pathProgress || typeof pathProgress !== 'object') return null;

  // Flatten lessons to a single timeline. We don't have completion
  // timestamps per lesson, so "most recent" approximates by the order
  // they appear in the `completed` array (which is push-on-completion,
  // so chronological by construction).
  const allLessons = [];
  Object.entries(pathProgress).forEach(([pathId, prog]) => {
    const completed = prog?.completed || [];
    const qc = prog?.quizCorrect || {};
    const qt = prog?.quizTotal || {};
    completed.forEach((lessonId, idx) => {
      const total = qt[lessonId] || 0;
      const correct = qc[lessonId] || 0;
      // Only count lessons that had a quiz — pure-reflection lessons
      // shouldn't push accuracy in either direction. Storing `qt` only
      // started with v1.0.12, so legacy lessons have total=0; skip them.
      if (total > 0) {
        allLessons.push({
          pathId,
          lessonId,
          // Sequence number — used as tiebreak for "most recent".
          seq: idx,
          accuracy: correct / total,
        });
      }
    });
  });

  if (allLessons.length < MIN_LESSONS_FOR_SIGNAL) return null;

  // Take the last N entries — `completed` is push-order, so the tail
  // is most-recent across each path. We don't have a true global
  // chronology without timestamps, so this approximation is fine.
  const recent = allLessons.slice(-ROLLING_WINDOW);
  const avg =
    recent.reduce((s, l) => s + l.accuracy, 0) / recent.length;

  // ── MASTERY MODE — surface a harder/locked path ─────────────────────
  if (avg >= MASTERY_THRESHOLD) {
    // Pick a path that the user hasn't started yet (zero completions).
    // Exclude their currently-active path. Prefer the next premium
    // path if the user is already premium; otherwise any unstarted one.
    const candidates = PATHS.filter((p) => {
      if (p.id === activePathId) return false;
      const prog = pathProgress[p.id];
      const done = prog?.completed?.length || 0;
      if (done >= (p.duration || 50)) return false; // already finished
      if (p.isPremium && !isPremium) return false; // skip locked
      return true;
    });
    // Prefer paths the user has NOT touched at all over half-done ones.
    const untouched = candidates.filter(
      (p) => !pathProgress[p.id]?.completed?.length,
    );
    const pick = (untouched.length ? untouched : candidates)[0];
    if (!pick) return null; // nothing left to suggest
    return {
      kind: 'mastery',
      accuracy: avg,
      suggestPathId: pick.id,
    };
  }

  // ── STRUGGLE MODE — soft "review" prompt ────────────────────────────
  if (avg <= STRUGGLE_THRESHOLD) {
    return {
      kind: 'struggle',
      accuracy: avg,
      currentPathId: activePathId,
    };
  }

  return null;
}

// Re-exported for tests and convenience.
export const ADAPTIVE_CONSTANTS = {
  MIN_LESSONS_FOR_SIGNAL,
  ROLLING_WINDOW,
  MASTERY_THRESHOLD,
  STRUGGLE_THRESHOLD,
};
