import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, checkLevelUp } from '../config/constants';
import { checkAchievements, checkSpecialAchievements } from '../config/achievements';
import {
  checkPremiumStatus,
  linkPurchaseUser,
  unlinkPurchaseUser,
} from '../services/purchases';
import { getRank } from '../config/ranks';
import { getPathById } from '../data/paths';
import { pullState, pushState, mergeStates } from '../services/cloudSync';
import {
  pushLeaderboardEntry,
  generateAnonUsername,
} from '../services/leaderboard';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import {
  cancelAllNotifications,
  scheduleStreakAtRiskReminder,
  scheduleComebackReminder,
  cancelComebackReminder,
} from '../services/notifications';

// ─── Initial State ───────────────────────────────────────────────────────────

const initialState = {
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

  // Streak calendar — { 'YYYY-MM-DD': count of lessons that day }
  lessonHistory: {},

  // Premium
  isPremium: false,
  streakFreezes: 0,

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

  // Anonymous handle for the public streak leaderboard. Generated on first
  // sign-in and re-used across devices via cloudSync.
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

  // Daily login bonus — date the user last received +5 XP for opening the
  // app. Sticky-by-date, so the bonus fires once per calendar day.
  dailyLoginGrantedAt: null,

  // Last lesson completed milestone celebration shown — flag UI reads to
  // trigger confetti animation once per milestone.
  _milestoneToast: null,

  // Internal
  _loaded: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Heart refill cadence — halved from 30 → 15 min in v1.0.12 because user
// feedback was "canlar hemen bitiyo" (hearts deplete too fast). At the
// previous 30-min rate, fully refilling 5 hearts from empty took 2.5
// hours, which created a punitive feel that hurt retention. 15-min cuts
// that to ~75 min, keeping the friction meaningful for free users but
// preventing the "abandon the app" reflex.
const HEART_REFILL_MINUTES = 15;

// Grace period after first install — for the first 24 hours, free users
// don't lose hearts on wrong answers. This dramatically improves day-1
// retention by removing the "I made one mistake and got blocked"
// frustration that kills onboarding conversion in habit apps.
const NEW_USER_GRACE_HOURS = 24;

// Bonus XP awarded when a lesson is finished without losing any hearts.
// Makes the heart system feel rewarding rather than purely punitive.
const PERFECT_LESSON_BONUS_XP = 10;

// ─── Reducer ─────────────────────────────────────────────────────────────────

const ACTION_TYPES = {
  LOAD_STATE: 'LOAD_STATE',
  COMPLETE_ONBOARDING: 'COMPLETE_ONBOARDING',
  SET_USER_PROFILE: 'SET_USER_PROFILE',
  SET_PREMIUM: 'SET_PREMIUM',
  USE_STREAK_FREEZE: 'USE_STREAK_FREEZE',
  AUTO_APPLY_STREAK_FREEZE: 'AUTO_APPLY_STREAK_FREEZE',
  CLEAR_STREAK_FREEZE_TOAST: 'CLEAR_STREAK_FREEZE_TOAST',
  DELETE_ACCOUNT: 'DELETE_ACCOUNT',
  REFRESH_TODAY: 'REFRESH_TODAY',
  COMPLETE_PATH_LESSON: 'COMPLETE_PATH_LESSON',
  SET_ACTIVE_PATH: 'SET_ACTIVE_PATH',
  LOSE_HEART: 'LOSE_HEART',
  REFILL_HEARTS: 'REFILL_HEARTS',
  RESET_AD_COUNTER: 'RESET_AD_COUNTER',
  RESET_PROGRESS: 'RESET_PROGRESS',
  ENSURE_ANON_USERNAME: 'ENSURE_ANON_USERNAME',
  START_VACATION: 'START_VACATION',
  END_VACATION: 'END_VACATION',
  COMPLETE_DAILY_CHALLENGE: 'COMPLETE_DAILY_CHALLENGE',
  OPEN_MYSTERY_BOX: 'OPEN_MYSTERY_BOX',
  GRANT_DAILY_LOGIN: 'GRANT_DAILY_LOGIN',
  CLEAR_MILESTONE_TOAST: 'CLEAR_MILESTONE_TOAST',
};

function appReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.LOAD_STATE: {
      const next = { ...state, ...action.payload, _loaded: true };
      // First-launch sentinel — stamp installedAt the very first time we
      // ever load state. Existing users who upgrade to this build will
      // also pick up the stamp now (their grace period is therefore
      // measured from upgrade time, not original install — accept that
      // as a one-time UX bonus rather than a perfect signal).
      if (!next.installedAt) {
        next.installedAt = new Date().toISOString();
      }
      return next;
    }

    case ACTION_TYPES.COMPLETE_ONBOARDING:
      return { ...state, onboarded: true };

    case ACTION_TYPES.SET_USER_PROFILE:
      return { ...state, userProfile: action.payload };

    case ACTION_TYPES.SET_PREMIUM:
      return {
        ...state,
        isPremium: !!action.payload,
        // Premium = unlimited hearts effectively
        hearts: action.payload ? 5 : state.hearts,
        // Premium activation grants 12 streak repair tokens (≈ 1/month for a
        // yearly sub). Existing token count is kept if higher so users who
        // already had some don't lose them on re-activation.
        streakFreezes: action.payload
          ? Math.max(state.streakFreezes || 0, 12)
          : state.streakFreezes,
      };

    case ACTION_TYPES.USE_STREAK_FREEZE:
      if (state.streakFreezes <= 0) return state;
      return { ...state, streakFreezes: state.streakFreezes - 1 };

    case ACTION_TYPES.AUTO_APPLY_STREAK_FREEZE: {
      // Called on app load. If the user has an active streak but missed
      // exactly yesterday, automatically burn a token to keep the streak
      // alive — assuming they have one. Setting lastCompletedDate to
      // yesterday makes the next lesson today extend the streak normally.
      if ((state.currentStreak || 0) === 0) return state;
      // If on vacation, skip — streak is frozen, not at risk.
      const today = getTodayDateString();
      const yesterday = getYesterdayDateString();
      if (state.vacationUntil && state.vacationUntil >= today) {
        // Bring lastCompletedDate forward to yesterday so the next lesson
        // counts as +1 streak normally without resetting.
        if (state.lastCompletedDate !== today && state.lastCompletedDate !== yesterday) {
          return { ...state, lastCompletedDate: yesterday };
        }
        return state;
      }
      if ((state.streakFreezes || 0) <= 0) return state;
      // No save needed if they're already up-to-date
      if (state.lastCompletedDate === today) return state;
      if (state.lastCompletedDate === yesterday) return state;
      // Only save a single missed day. Multiple missed days = streak ends.
      const dayBeforeYesterday = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      })();
      if (state.lastCompletedDate !== dayBeforeYesterday) return state;
      return {
        ...state,
        streakFreezes: state.streakFreezes - 1,
        lastCompletedDate: yesterday,
        // UI reads this to surface a one-shot toast.
        _streakFreezeToast: Date.now(),
      };
    }

    case ACTION_TYPES.CLEAR_STREAK_FREEZE_TOAST:
      return { ...state, _streakFreezeToast: null };

    case ACTION_TYPES.START_VACATION: {
      // payload = { days } — clamps 1..7
      const days = Math.max(1, Math.min(7, action.payload?.days || 7));
      const end = new Date();
      end.setDate(end.getDate() + days);
      const y = end.getFullYear();
      const m = String(end.getMonth() + 1).padStart(2, '0');
      const dd = String(end.getDate()).padStart(2, '0');
      return { ...state, vacationUntil: `${y}-${m}-${dd}` };
    }

    case ACTION_TYPES.END_VACATION:
      return { ...state, vacationUntil: null };

    case ACTION_TYPES.COMPLETE_DAILY_CHALLENGE: {
      const today = getTodayDateString();
      // Already done today — no-op. Prevents double-claiming bonus XP.
      if (state.dailyChallengeCompletedAt === today) return state;
      const bonus = action.payload?.bonusXp || 25;
      const newTotalXP = (state.totalXP || 0) + bonus;
      const newLevel = checkLevelUp(newTotalXP, state.level || 1);
      return {
        ...state,
        dailyChallengeCompletedAt: today,
        totalXP: newTotalXP,
        level: newLevel,
      };
    }

    case ACTION_TYPES.OPEN_MYSTERY_BOX: {
      const today = getTodayDateString();
      // Already opened today — no-op. The card stays visible showing
      // the previous reward, but no new reward is granted.
      if (state.dailyMysteryBoxOpenedAt === today) return state;
      const { rewardId, kind, value } = action.payload || {};
      let newTotalXP = state.totalXP || 0;
      let newLevel = state.level || 1;
      let newFreezes = state.streakFreezes || 0;
      if (kind === 'xp') {
        newTotalXP += value;
        newLevel = checkLevelUp(newTotalXP, newLevel);
      } else if (kind === 'freeze' || kind === 'streak_bonus') {
        // streak_bonus = an "extra" freeze valid for streak protect.
        // For now both kinds just bump the streakFreezes counter.
        newFreezes += value;
      }
      return {
        ...state,
        dailyMysteryBoxOpenedAt: today,
        dailyMysteryBoxLastReward: rewardId || null,
        totalXP: newTotalXP,
        level: newLevel,
        streakFreezes: newFreezes,
      };
    }

    case ACTION_TYPES.GRANT_DAILY_LOGIN: {
      const today = getTodayDateString();
      if (state.dailyLoginGrantedAt === today) return state;
      const bonus = action.payload?.bonusXp || 5;
      const newTotalXP = (state.totalXP || 0) + bonus;
      const newLevel = checkLevelUp(newTotalXP, state.level || 1);
      return {
        ...state,
        dailyLoginGrantedAt: today,
        totalXP: newTotalXP,
        level: newLevel,
      };
    }

    case ACTION_TYPES.CLEAR_MILESTONE_TOAST:
      return { ...state, _milestoneToast: null };

    case ACTION_TYPES.ENSURE_ANON_USERNAME: {
      // Generate once, then sticky. cloudSync will replicate the chosen
      // handle across devices so the user stays the same monk.
      if (state.anonUsername) return state;
      return { ...state, anonUsername: action.payload };
    }

    case ACTION_TYPES.DELETE_ACCOUNT:
      return { ...initialState, _loaded: true };

    case ACTION_TYPES.RESET_PROGRESS:
      // Wipe lesson progress + streak + XP + level + achievements,
      // BUT keep onboarded, isPremium, hearts, profile.
      return {
        ...state,
        totalXP: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null,
        lessonHistory: {},
        unlockedAchievements: [],
        pathProgress: {},
      };

    case ACTION_TYPES.REFRESH_TODAY: {
      const today = getTodayDateString();
      return {
        ...state,
        todayCompleted: state.lastCompletedDate === today,
      };
    }

    case ACTION_TYPES.SET_ACTIVE_PATH:
      return { ...state, activePathId: action.payload };

    case ACTION_TYPES.LOSE_HEART: {
      if (state.isPremium) return state; // premium = unlimited
      const newHearts = Math.max(0, state.hearts - 1);
      const refillAt =
        newHearts < 5 && !state.heartsRefillAt
          ? new Date(Date.now() + HEART_REFILL_MINUTES * 60 * 1000).toISOString()
          : state.heartsRefillAt;
      return { ...state, hearts: newHearts, heartsRefillAt: refillAt };
    }

    case ACTION_TYPES.REFILL_HEARTS:
      return { ...state, hearts: 5, heartsRefillAt: null };

    case ACTION_TYPES.RESET_AD_COUNTER:
      return { ...state, actionsSinceLastAd: 0 };

    case ACTION_TYPES.COMPLETE_PATH_LESSON: {
      const {
        pathId,
        lessonId,
        reflection,
        reflectionAudioUri,
        quizCorrect = 0,
        quizTotal = 0,
        xp = 15,
      } = action.payload;
      const today = getTodayDateString();
      const current = state.pathProgress[pathId] || {
        completed: [],
        reflections: {},
        reflectionAudio: {},
        quizCorrect: {},
      };
      if (current.completed.includes(lessonId)) return state;

      // ── Bonus XP multipliers ──────────────────────────────────────────
      // Comeback bonus: returning after 3+ days gone gives 2x XP, once.
      // Random bonus days: Monday + Friday are 2x days. Stacks with
      // comeback (rare overlap = 4x — that's a feature, not a bug).
      let xpMultiplier = 1;
      let comebackApplied = false;
      if (state.lastCompletedDate) {
        const last = new Date(state.lastCompletedDate);
        const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);
        if (daysSince >= 3) {
          xpMultiplier *= 2;
          comebackApplied = true;
        }
      }
      const dow = new Date().getDay();
      const isBonusDay = dow === 1 || dow === 5; // Mon or Fri
      if (isBonusDay) xpMultiplier *= 2;

      // ── Variable rewards (v1.0.12) ────────────────────────────────────
      // Surprise reward — ~20% chance of an extra 2x. Variable schedules
      // are the most addictive reinforcement pattern (casino mechanic).
      // Stacks with the deterministic multipliers above.
      const isSurpriseDay = Math.random() < 0.2;
      if (isSurpriseDay) xpMultiplier *= 2;

      // Perfect Lesson Bonus — completing every quiz question correctly
      // (i.e., not losing any hearts) earns a flat bonus. Makes the
      // heart system feel rewarding, not just punitive. Falls back to
      // false when quizTotal is unknown (legacy callers) or the lesson
      // had no quiz at all.
      const isPerfectLesson =
        quizTotal > 0 && quizCorrect >= quizTotal;
      const perfectBonus = isPerfectLesson ? PERFECT_LESSON_BONUS_XP : 0;

      const finalXp = Math.round(xp * xpMultiplier) + perfectBonus;
      const newTotalXP = state.totalXP + finalXp;
      const newLevel = checkLevelUp(newTotalXP, state.level);

      // Streak update — completing a lesson counts as today's action
      let newStreak = state.currentStreak;
      let newLastDate = state.lastCompletedDate;
      if (state.lastCompletedDate !== today) {
        const yesterday = getYesterdayDateString();
        newStreak = state.lastCompletedDate === yesterday ? state.currentStreak + 1 : 1;
        newLastDate = today;
      }

      // Check achievements (regular threshold-based) + specials (event-based)
      const totalCompleted = Object.values(state.pathProgress).reduce(
        (sum, p) => sum + (p?.completed?.length || 0),
        0,
      ) + 1;
      const newAchievements = checkAchievements({
        totalLessonsCompleted: totalCompleted,
        streak: newStreak,
        level: newLevel,
        unlocked: state.unlockedAchievements,
        isPremium: state.isPremium,
      });
      const newSpecials = checkSpecialAchievements({
        now: new Date(),
        unlocked: state.unlockedAchievements,
      });

      // Milestone toast: trigger confetti + haptic on these streak counts.
      const MILESTONES = [7, 14, 30, 50, 100, 365];
      const hitMilestone = MILESTONES.includes(newStreak)
        && state.currentStreak !== newStreak;
      const milestoneToast = hitMilestone
        ? { streak: newStreak, comebackApplied, isBonusDay, ts: Date.now() }
        : state._milestoneToast;

      return {
        ...state,
        pathProgress: {
          ...state.pathProgress,
          [pathId]: {
            completed: [...current.completed, lessonId],
            reflections: reflection
              ? { ...current.reflections, [lessonId]: reflection }
              : current.reflections,
            reflectionAudio: reflectionAudioUri
              ? { ...(current.reflectionAudio || {}), [lessonId]: reflectionAudioUri }
              : current.reflectionAudio || {},
            quizCorrect: { ...current.quizCorrect, [lessonId]: quizCorrect },
          },
        },
        totalXP: newTotalXP,
        level: newLevel,
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak || 0, newStreak),
        lastCompletedDate: newLastDate,
        lessonHistory: {
          ...(state.lessonHistory || {}),
          [today]: ((state.lessonHistory || {})[today] || 0) + 1,
        },
        actionsSinceLastAd: (state.actionsSinceLastAd || 0) + 1,
        unlockedAchievements: [
          ...state.unlockedAchievements,
          ...newAchievements.filter((a) => !state.unlockedAchievements.includes(a)),
          ...newSpecials.filter((a) => !state.unlockedAchievements.includes(a)),
        ],
        _milestoneToast: milestoneToast,
      };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;

  // ── Bootstrap: hydrate from AsyncStorage ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_STATE);
        if (raw) {
          const parsed = JSON.parse(raw);
          const today = getTodayDateString();
          const todayCompleted = parsed.lastCompletedDate === today;

          // Auto-refill hearts if past refillAt
          let hearts = parsed.hearts ?? 5;
          let heartsRefillAt = parsed.heartsRefillAt;
          if (heartsRefillAt && new Date(heartsRefillAt) < new Date()) {
            hearts = 5;
            heartsRefillAt = null;
          }

          dispatch({
            type: ACTION_TYPES.LOAD_STATE,
            payload: { ...parsed, todayCompleted, hearts, heartsRefillAt },
          });
        } else {
          dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: {} });
        }
      } catch (e) {
        console.error('[AppContext] Failed to load state:', e);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: {} });
      }
    })();
  }, []);

  // ── On load, try to save the streak with a freeze if user missed yesterday
  useEffect(() => {
    if (!state._loaded) return;
    dispatch({ type: ACTION_TYPES.AUTO_APPLY_STREAK_FREEZE });
    // Daily login bonus: +5 XP the first time you open the app each day.
    // The reducer no-ops if already granted today, so this is safe to fire
    // on every load.
    dispatch({ type: ACTION_TYPES.GRANT_DAILY_LOGIN, payload: { bonusXp: 5 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state._loaded]);

  // ── Ensure the user has an anon handle for the leaderboard ───────────────
  useEffect(() => {
    if (!state._loaded) return;
    if (state.anonUsername) return;
    dispatch({
      type: ACTION_TYPES.ENSURE_ANON_USERNAME,
      payload: generateAnonUsername(),
    });
  }, [state._loaded, state.anonUsername]);

  // ── Smart re-engagement notifications ────────────────────────────────────
  // Streak-at-risk: re-evaluated whenever today's completion or streak
  // changes, so it cancels itself the moment the user does today's lesson.
  // Comeback: only fires when the user has been gone 3+ days; cancels the
  // next time the app opens (state._loaded effect below).
  useEffect(() => {
    if (!state._loaded) return;
    const today = getTodayDateString();
    const onVacation =
      !!state.vacationUntil && state.vacationUntil >= today;
    scheduleStreakAtRiskReminder({
      todayCompleted: state.lastCompletedDate === today,
      currentStreak: state.currentStreak || 0,
      onVacation,
    }).catch(() => {});
  }, [
    state._loaded,
    state.lastCompletedDate,
    state.currentStreak,
    state.vacationUntil,
  ]);

  useEffect(() => {
    if (!state._loaded) return;
    // Cancel any comeback push immediately on app open (user is back), then
    // schedule a fresh one based on the latest lastCompletedDate.
    cancelComebackReminder().catch(() => {});
    scheduleComebackReminder({
      lastCompletedDate: state.lastCompletedDate,
    }).catch(() => {});
  }, [state._loaded, state.lastCompletedDate]);

  // ── Push streak to public leaderboard whenever it changes ────────────────
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    if (!state.anonUsername) return;
    pushLeaderboardEntry(userId, {
      anonUsername: state.anonUsername,
      currentStreak: state.currentStreak || 0,
      longestStreak: state.longestStreak || 0,
      totalXP: state.totalXP || 0,
    }).catch(() => {});
  }, [
    state._loaded,
    isAuthenticated,
    userId,
    state.anonUsername,
    state.currentStreak,
    state.longestStreak,
    state.totalXP,
  ]);

  // ── Save state to AsyncStorage on every change ─────────────────────────
  useEffect(() => {
    if (!state._loaded) return;
    const toSave = { ...state };
    delete toSave._loaded;
    delete toSave._streakFreezeToast;
    delete toSave._milestoneToast;
    AsyncStorage.setItem(STORAGE_KEYS.USER_STATE, JSON.stringify(toSave)).catch(
      (e) => console.error('[AppContext] Failed to save state:', e),
    );
  }, [state]);

  // ── Cloud pull on first sign-in ─────────────────────────────────────────
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const remote = await pullState(userId);
        if (cancelled || !remote) return;

        const local = { ...state };
        delete local._loaded;
        // Per-path merge — never drops progress from either side. See
        // services/cloudSync.js for the merge rules.
        const merged = mergeStates(local, remote);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: merged });
      } catch (e) {
        console.warn('[AppContext] Cloud pull failed:', e?.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state._loaded, isAuthenticated, userId]);

  // ── Cloud push debounced ────────────────────────────────────────────────
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    const timer = setTimeout(() => {
      const toPush = { ...state };
      delete toPush._loaded;
      pushState(userId, toPush).catch((e) =>
        console.warn('[AppContext] Cloud push failed:', e?.message),
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [state, isAuthenticated, userId]);

  // ── Premium status check on auth ────────────────────────────────────────
  // Also keeps the RevenueCat customer record in sync with the Supabase
  // session so subscriptions follow the user across devices.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (userId) {
          await linkPurchaseUser(userId);
        } else {
          await unlinkPurchaseUser();
        }
      } catch (e) {
        console.warn('[AppContext] Purchase user link failed:', e?.message);
      }
      if (cancelled) return;
      try {
        const isPremium = await checkPremiumStatus();
        if (!cancelled) {
          dispatch({ type: ACTION_TYPES.SET_PREMIUM, payload: isPremium });
        }
      } catch (e) {
        console.warn('[AppContext] Premium check failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Today refresh on date change ────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: ACTION_TYPES.REFRESH_TODAY });
    }, 60 * 1000); // every minute
    return () => clearInterval(interval);
  }, []);

  // ── Action creators ─────────────────────────────────────────────────────
  const completeOnboarding = useCallback(() => {
    dispatch({ type: ACTION_TYPES.COMPLETE_ONBOARDING });
  }, []);

  const setUserProfile = useCallback((profile) => {
    dispatch({ type: ACTION_TYPES.SET_USER_PROFILE, payload: profile });
  }, []);

  const setPremium = useCallback((isPremium) => {
    dispatch({ type: ACTION_TYPES.SET_PREMIUM, payload: isPremium });
  }, []);

  const useStreakFreezeAction = useCallback(() => {
    dispatch({ type: ACTION_TYPES.USE_STREAK_FREEZE });
  }, []);

  const clearStreakFreezeToast = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_STREAK_FREEZE_TOAST });
  }, []);

  const startVacation = useCallback((days = 7) => {
    dispatch({ type: ACTION_TYPES.START_VACATION, payload: { days } });
  }, []);

  const endVacation = useCallback(() => {
    dispatch({ type: ACTION_TYPES.END_VACATION });
  }, []);

  const completeDailyChallenge = useCallback((bonusXp = 25) => {
    dispatch({
      type: ACTION_TYPES.COMPLETE_DAILY_CHALLENGE,
      payload: { bonusXp },
    });
  }, []);

  /**
   * Open the daily mystery box. Reward payload comes from the
   * DailyMysteryBox component (it does the weighted pick locally so
   * the animation is in sync). One-per-day; subsequent calls are no-ops
   * until midnight.
   */
  const openMysteryBox = useCallback((reward) => {
    if (!reward) return;
    dispatch({
      type: ACTION_TYPES.OPEN_MYSTERY_BOX,
      payload: {
        rewardId: reward.id,
        kind: reward.kind,
        value: reward.value,
      },
    });
  }, []);

  const clearMilestoneToast = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_MILESTONE_TOAST });
  }, []);

  const deleteAccount = useCallback(async () => {
    // Apple guideline 5.1.1(v): account creation requires server-side
    // deletion. Call the Supabase Edge Function 'delete-user' which removes
    // the auth.users row (cascades to user_state via FK).
    let serverOk = false;
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (!error) serverOk = true;
      else console.warn('delete-user function error:', error.message);
    } catch (e) {
      console.warn('delete-user invoke failed:', e?.message);
    }

    // Detach the deleted user from RevenueCat so a fresh signup doesn't
    // inherit the deleted user's entitlements.
    try {
      await unlinkPurchaseUser();
    } catch (e) {
      console.warn('unlinkPurchaseUser failed during deleteAccount:', e?.message);
    }

    // Cancel scheduled local notifications so they stop firing.
    try {
      await cancelAllNotifications();
    } catch {}

    // Wipe local cache regardless of server outcome — user wants out.
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_STATE,
        STORAGE_KEYS.ONBOARDED,
        STORAGE_KEYS.AD_COUNTER,
      ]);
    } catch {}
    dispatch({ type: ACTION_TYPES.DELETE_ACCOUNT });

    // Surface server failure to the caller so it can re-attempt or warn.
    return serverOk;
  }, []);

  const setActivePath = useCallback((pathId) => {
    dispatch({ type: ACTION_TYPES.SET_ACTIVE_PATH, payload: pathId });
  }, []);

  const completePathLesson = useCallback(
    ({ pathId, lessonId, reflection, reflectionAudioUri, quizCorrect = 0, xp = 15 }) => {
      dispatch({
        type: ACTION_TYPES.COMPLETE_PATH_LESSON,
        payload: { pathId, lessonId, reflection, reflectionAudioUri, quizCorrect, xp },
      });
    },
    [],
  );

  const loseHeart = useCallback(() => {
    dispatch({ type: ACTION_TYPES.LOSE_HEART });
  }, []);

  const refillHearts = useCallback(() => {
    dispatch({ type: ACTION_TYPES.REFILL_HEARTS });
  }, []);

  const resetAdCounter = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET_AD_COUNTER });
  }, []);

  const resetProgress = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESET_PROGRESS });
    // Re-arm the post-lesson paywall trigger so it can fire again after
    // the user crosses 3 lessons in their new run. Fire-and-forget.
    import('../services/paywallTrigger')
      .then((m) => m.resetPostLessonPaywallTrigger())
      .catch(() => {});
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  // A path counts as completed (for rank purposes) when the user has finished
  // all of its lessons. Falls back to 50 if the path isn't found.
  const completedPathsCount = Object.entries(state.pathProgress).filter(
    ([pathId, prog]) => {
      const required = getPathById(pathId)?.duration ?? 50;
      return (prog?.completed?.length || 0) >= required;
    },
  ).length;
  const rank = getRank(completedPathsCount);

  const totalLessonsCompleted = Object.values(state.pathProgress).reduce(
    (sum, p) => sum + (p?.completed?.length || 0),
    0,
  );

  // First-24h grace period — free users in this window don't lose hearts
  // on wrong quiz answers. Derived from installedAt; if a user has been
  // around for years, isInGracePeriod is always false.
  const isInGracePeriod = (() => {
    if (!state.installedAt) return false;
    const installedMs = new Date(state.installedAt).getTime();
    if (Number.isNaN(installedMs)) return false;
    const ageMs = Date.now() - installedMs;
    return ageMs < NEW_USER_GRACE_HOURS * 60 * 60 * 1000;
  })();

  const value = {
    ...state,
    rank,
    completedPathsCount,
    totalLessonsCompleted,
    isInGracePeriod,
    completeOnboarding,
    setUserProfile,
    setPremium,
    useStreakFreezeAction,
    clearStreakFreezeToast,
    startVacation,
    endVacation,
    completeDailyChallenge,
    openMysteryBox,
    clearMilestoneToast,
    deleteAccount,
    setActivePath,
    completePathLesson,
    loseHeart,
    refillHearts,
    resetAdCounter,
    resetProgress,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
