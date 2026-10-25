import { toLocalDateString } from '../utils/dateOnly';

export const initialState = {
  onboarded: false,

  // When the user first opened the app. Used to compute the new-user
  // grace period for hearts (free users don't lose hearts in the first
  // 24h, see NEW_USER_GRACE_HOURS). Set on the first state load if
  // missing — so existing users won't get a retroactive grace period.
  installedAt: null,

  // Personalization
  userProfile: null, // { goals: string[], answers: object }

  // Gamification
  totalXP: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,

  // Streak Repair bookkeeping (rewarded-ad "undo the broken streak").
  streakRepairsUsed: 0,

  // ── Momentum loop (single-session chaining) ────────────────────────
  // The audit's "5 minutes then they're gone" finding: sessions ended
  // after 1 lesson with no pull into a second. We now count lessons
  // completed within a 30-minute window of each other and grant an
  // escalating chain XP bonus (+25 / +50 / +75 / +100). Reset when
  // the session times out (no new lesson within 30 min) or the day
  // rolls over.
  //   - lastLessonAtMs: timestamp of last COMPLETE_PATH_LESSON dispatch
  //   - todaySessionLessons: count within the current session window
  //   - _momentumToast: { chainCount, bonusXp, ts } — one-shot UI ping
  lastLessonAtMs: 0,
  todaySessionLessons: 0,
  _momentumToast: null,
  _lessonReward: null,

  // Per-path commitment-device pledges. Behavioural-econ research:
  // a written, self-authored sentence raises adherence ~30% even if
  // the user never re-reads it. Shape: { [pathId]: 'sentence' }.
  pathPledges: {},

  // ── Outcome Assessment ─────────────────────────────────────────────
  // The user's self-rated baseline (taken at onboarding) and the
  // history of subsequent re-assessments (every 30 days). Shape:
  //   baselineAssessment: { ts, scores: {discipline:5, focus:4, ...} }
  //   assessmentHistory: [{ ts, scores }, ...]   newest last
  //   latestAssessment: convenience pointer to history[last]
  // Without baselineAssessment, the ProgressReportScreen has nothing
  // to compare against — so the onboarding step that collects it is
  // gated as a soft-required (skippable but the report system
  // visibly nags until done).
  baselineAssessment: null,
  assessmentHistory: [],
  latestAssessment: null,

  // Daily Deck completions — the bite-sized morning ritual. Each
  // entry: { deckId, ts, response, actionCommitted }. The response
  // text feeds the Reflection Treasure / Reflections archive as
  // a parallel stream to lesson reflections. Trimmed to last 60.
  dailyDeckHistory: [],
  lastDailyDeckCompletedDate: null,

  // Streak calendar — { 'YYYY-MM-DD': count of lessons that day }
  lessonHistory: {},

  // Premium
  isPremium: false,
  streakFreezes: 0,
  referralOwnerRewardIds: [],

  // Achievements
  unlockedAchievements: [],

  // Hearts (Duolingo-style life system)
  hearts: 5,
  heartsRefillAt: null, // ISO timestamp when next heart refills

  // Today
  todayCompleted: false,

  // Ad counter
  actionsSinceLastAd: 0,

  // ── Discipline Academy (path-based curriculum) ────────────────────────
  // pathProgress: {
  //   [pathId]: {
  //     completed: [lessonId, ...],
  //     reflections: { [lessonId]: text },
  //     quizCorrect: { [lessonId]: number }, // # correct answers
  //   }
  // }
  pathProgress: {},
  activePathId: 'dopamine-detox',

  // Anonymous profile handle. Generated on first sign-in and re-used across
  // devices via cloudSync.
  anonUsername: null,

  // Streak Vacation Mode (premium): user can pause their streak for up to
  // 7 days at a time. While active, the auto-burn freeze logic is bypassed
  // and the streak isn't extended (no lesson required) but also doesn't
  // reset on missed days. Stored as the ISO date the vacation ends.
  vacationUntil: null,

  // Daily mystery challenge — last completed date string. The pool resets
  // every day so this is a single sticky flag, not a list.
  dailyChallengeCompletedAt: null,

  // Daily Mystery Box (v1.0.12) — variable-reward mechanic. User can
  // open it once per calendar day; the result is stored so the card
  // remembers what they got (positive reinforcement to return tomorrow).
  dailyMysteryBoxOpenedAt: null,   // 'YYYY-MM-DD' of last open
  dailyMysteryBoxLastReward: null, // reward ID from DailyMysteryBox.REWARDS

  // Daily Mood Check-in (v1.0.12) — fresh mood signal captured each day
  // to refresh the personalization. The onboarding mood is a one-time
  // snapshot; this overrides it daily so the daily challenge actually
  // adapts to how the user feels today.
  dailyMoodCheckInDate: null,  // 'YYYY-MM-DD' of last check-in
  dailyMoodCheckInValue: null, // mood id: 'motivated' | 'fresh' | 'lost'

  // Daily login bonus — date the user last received +5 XP for opening the
  // app. Sticky-by-date, so the bonus fires once per calendar day.
  dailyLoginGrantedAt: null,

  // Last lesson completed milestone celebration shown — flag UI reads to
  // trigger confetti animation once per milestone.
  _milestoneToast: null,

  // Internal
  _loaded: false,
};

export const HEART_REFILL_MINUTES = 15;
export const MAX_HEARTS = 5;
export const LOCAL_STATE_LOAD_TIMEOUT_MS = 4000;
export const NEW_USER_GRACE_HOURS = 24;
export const PERFECT_LESSON_BONUS_XP = 10;

export const getTodayDateString = () => toLocalDateString(new Date());

export const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
};

export const normalizeAnonUsername = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/^monk_/, 'ascender_');
};

export const withTimeout = (promise, ms, label) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
