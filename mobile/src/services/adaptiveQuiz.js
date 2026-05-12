// Adaptive Quiz Engine (#2A)
// ──────────────────────────────────────────────────────────────────────
// Reads the user's per-question answer log (state.quizAnswers) and
// extends a lesson's base quiz with 0–2 *review* questions pulled from
// prior lessons in the SAME path. Preference is wrong-answered ones —
// spaced repetition of weak spots.
//
// Triggering rules:
//   - Only kicks in after the user has finished 3 lessons in this path
//     (a warmup so the first few lessons don't feel inconsistent).
//   - Recent accuracy < 50%   → no bonus (don't pile on a struggling user).
//   - Recent accuracy 50–84%  → 1 bonus review question.
//   - Recent accuracy ≥ 85%   → 2 bonus review questions ("harder" track).
//
// Question selection:
//   1. Scan completed lessons in this path for wrong-answered questions.
//      Pick from the wrongs first (most pedagogically valuable).
//   2. If no wrongs available (perfect user), pick any prior question
//      as a refresher.
//   3. Never pick a question already used in the current call (avoid
//      duplicates inside the same bonus pair).
//
// All this layer does is build the quiz array; LessonScreen owns the
// "this is a review question" UI affordance via the baseLength count.

const TRIGGER_AFTER_LESSONS = 3;
const ACCURACY_REVIEW_FLOOR = 0.5;
const ACCURACY_HARD_FLOOR = 0.85;

const orderFromLessonId = (lessonId) => {
  const match = String(lessonId || '').match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Compute the user's recent quiz accuracy across all completed lessons
 * in the given path. Returns null if there's no data to draw from.
 */
export function pathQuizAccuracy(pathId, pathProgress, quizAnswers) {
  const completed = pathProgress?.[pathId]?.completed || [];
  let correct = 0;
  let total = 0;
  for (const lessonId of completed) {
    const answers = quizAnswers?.[lessonId];
    if (!Array.isArray(answers)) continue;
    for (const a of answers) {
      if (!a || typeof a.correct !== 'boolean') continue;
      total += 1;
      if (a.correct) correct += 1;
    }
  }
  if (total === 0) return null;
  return correct / total;
}

/**
 * Iterate every completed lesson's question and yield (lessonId, order,
 * qIndex, question, wasWrong) tuples. `t` is the i18n translator used
 * to fetch the question text from the lessons.<lang>.json blobs.
 */
function gatherPriorQuestions(t, pathId, currentLessonOrder, pathProgress, quizAnswers) {
  const completed = pathProgress?.[pathId]?.completed || [];
  const out = [];
  for (const lessonId of completed) {
    const order = orderFromLessonId(lessonId);
    if (order === null) continue;
    if (order === currentLessonOrder) continue;
    const questions = t(`lessons.${pathId}.${order}.quiz`, {
      returnObjects: true,
    });
    if (!Array.isArray(questions)) continue;
    const answers = quizAnswers?.[lessonId] || [];
    for (let i = 0; i < questions.length; i++) {
      const a = answers[i];
      out.push({
        lessonId,
        order,
        qIndex: i,
        question: questions[i],
        wasWrong: !!(a && a.correct === false),
        attempted: !!a,
        key: `${order}:${i}`,
      });
    }
  }
  return out;
}

/**
 * Pick `count` review questions, preferring wrong-answered first. Uses
 * `used` to skip already-picked keys (so the second bonus question
 * isn't a duplicate of the first).
 */
function pickReviewQuestions(pool, count) {
  const wrongs = pool.filter((q) => q.wasWrong);
  const attempted = pool.filter((q) => q.attempted && !q.wasWrong);
  const fresh = pool.filter((q) => !q.attempted);
  const picks = [];
  const used = new Set();

  // Helper: random pick from `arr` skipping already-used keys.
  const pickOne = (arr) => {
    const candidates = arr.filter((q) => !used.has(q.key));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  while (picks.length < count) {
    const next =
      pickOne(wrongs) || pickOne(attempted) || pickOne(fresh);
    if (!next) break;
    used.add(next.key);
    picks.push(next);
  }
  return picks;
}

/**
 * Build the (possibly adapted) quiz for a lesson.
 *
 * @returns {{
 *   questions: Array,
 *   baseLength: number,
 *   bonusCount: number,
 *   bonusMeta: Array<{ fromOrder: number }>,
 *   accuracy: number | null,
 * }}
 *
 * The caller treats `questions[i]` for `i >= baseLength` as a "review"
 * question (different visual treatment).
 */
export function getAdaptiveQuiz({
  t,
  pathId,
  lessonOrder,
  pathProgress,
  quizAnswers,
}) {
  const baseQuestions = t(`lessons.${pathId}.${lessonOrder}.quiz`, {
    returnObjects: true,
  });
  const base = Array.isArray(baseQuestions) ? baseQuestions : [];

  const completedCount = pathProgress?.[pathId]?.completed?.length || 0;
  if (completedCount < TRIGGER_AFTER_LESSONS) {
    return {
      questions: base,
      baseLength: base.length,
      bonusCount: 0,
      bonusMeta: [],
      accuracy: null,
    };
  }

  const accuracy = pathQuizAccuracy(pathId, pathProgress, quizAnswers);
  if (accuracy === null || accuracy < ACCURACY_REVIEW_FLOOR) {
    return {
      questions: base,
      baseLength: base.length,
      bonusCount: 0,
      bonusMeta: [],
      accuracy,
    };
  }

  const targetBonus = accuracy >= ACCURACY_HARD_FLOOR ? 2 : 1;
  const pool = gatherPriorQuestions(
    t,
    pathId,
    lessonOrder,
    pathProgress,
    quizAnswers,
  );
  const picks = pickReviewQuestions(pool, targetBonus);

  return {
    questions: [...base, ...picks.map((p) => p.question)],
    baseLength: base.length,
    bonusCount: picks.length,
    // Per-bonus metadata. LessonScreen uses this to update the ORIGINAL
    // lesson's answer record when the user answers a review question
    // (otherwise we'd keep surfacing the same "wrong" question forever
    // even after the user nails the retry).
    bonusMeta: picks.map((p) => ({
      fromLessonId: p.lessonId,
      fromQIndex: p.qIndex,
      fromOrder: p.order,
    })),
    accuracy,
  };
}
