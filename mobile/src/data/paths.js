// Ascend Monk Mode — Discipline Academy
// Duolingo-style sequential learning paths.
//
// Each path has ordered lessons. Lessons unlock sequentially.
// All teaching/action/reflection text is in i18n keys (per-locale).

// Each path has both an emoji (legacy) and a materialIcon (Stitch design).
// Free-lesson tuning: brand-new users were hitting the paywall too fast
// (5 lessons on the primary path ≈ one sitting), then bailing because the
// app felt "thin" before they'd even built a habit. Doubling the free
// allowance on the primary path and bumping the secondary paths from 3
// to 5 still keeps premium scarce (30 of 250 lessons free = 12%), but
// gives the user real time to feel the streak forming before being asked
// to pay.
export const PATHS = [
  {
    id: 'dopamine-detox',
    icon: '🚫',
    materialIcon: 'leak-remove',
    color: '#FF6B6B',
    duration: 50,
    order: 1,
    freeLessons: 10,
  },
  {
    id: 'silent-morning',
    icon: '🌅',
    materialIcon: 'wb-twilight',
    color: '#FDE047',
    duration: 50,
    order: 2,
    freeLessons: 5,
  },
  {
    id: 'mind-discipline',
    icon: '🧠',
    materialIcon: 'psychology',
    color: '#6366F1',
    duration: 50,
    order: 3,
    freeLessons: 5,
  },
  {
    id: 'body-discipline',
    icon: '💪',
    materialIcon: 'fitness-center',
    color: '#10B981',
    duration: 50,
    order: 4,
    freeLessons: 5,
  },
  {
    id: 'money-discipline',
    icon: '💰',
    materialIcon: 'account-balance-wallet',
    color: '#F59E0B',
    duration: 50,
    order: 5,
    freeLessons: 5,
  },
];

// Lesson IDs: <pathId>-<order> e.g. dopamine-detox-1
// i18n schema (per-locale, in lessons.<lang>.json):
//   lessons.<pathId>.<order>.title
//   lessons.<pathId>.<order>.teaching       // 100-150 word read
//   lessons.<pathId>.<order>.quiz           // array of MC questions (NEW)
//     [{ q: "question", options: ["a","b","c","d"], correct: 0, explain: "..." }]
//   lessons.<pathId>.<order>.action         // commit action text
//   lessons.<pathId>.<order>.reflectionPrompt  // optional reflection
export const buildLesson = (pathId, order) => ({
  id: `${pathId}-${order}`,
  pathId,
  order,
  i18nKey: `lessons.${pathId}.${order}`,
});

/**
 * Get quiz questions for a lesson from i18n.
 * @param {(key: string, fallback?: any) => any} t - i18n translator
 * @param {string} pathId
 * @param {number} order
 * @returns {Array} array of quiz questions (may be empty)
 */
export const getQuizForLesson = (t, pathId, order) => {
  const quiz = t(`lessons.${pathId}.${order}.quiz`, { returnObjects: true });
  return Array.isArray(quiz) ? quiz : [];
};

export const getPathLessons = (path) =>
  Array.from({ length: path.duration }, (_, i) => buildLesson(path.id, i + 1));

export const getPathById = (id) => PATHS.find((p) => p.id === id) || null;

export const getLessonById = (lessonId) => {
  const [pathId, orderStr] = lessonId.match(/^(.+)-(\d+)$/)?.slice(1) || [];
  if (!pathId) return null;
  const order = parseInt(orderStr, 10);
  return buildLesson(pathId, order);
};

// Determine if a lesson is locked given user's progress
export const getLessonState = (lesson, userProgress) => {
  const pathProgress = userProgress?.[lesson.pathId] || { completed: [] };
  const path = getPathById(lesson.pathId);
  if (!path) return 'locked';

  // Completed
  if (pathProgress.completed.includes(lesson.id)) return 'completed';

  // Current = first lesson with no prior incomplete
  // Previous order must all be completed (or this is order 1)
  const allPrevDone = lesson.order === 1
    || Array.from({ length: lesson.order - 1 }, (_, i) => `${lesson.pathId}-${i + 1}`)
        .every((id) => pathProgress.completed.includes(id));

  if (allPrevDone) return 'current';
  return 'locked';
};

export const isPathComplete = (path, userProgress) => {
  const pathProgress = userProgress?.[path.id];
  if (!pathProgress) return false;
  return pathProgress.completed.length >= path.duration;
};

export const getCurrentLesson = (path, userProgress) => {
  const lessons = getPathLessons(path);
  return lessons.find((l) => getLessonState(l, userProgress) === 'current') || null;
};

export const getPathProgress = (path, userProgress) => {
  const pathProgress = userProgress?.[path.id];
  const completed = pathProgress?.completed?.length || 0;
  return {
    completed,
    total: path.duration,
    percent: Math.round((completed / path.duration) * 100),
  };
};
