import { checkLevelUp } from '../config/constants';
import { checkAchievements, checkSpecialAchievements } from '../config/achievements';
import { calendarDaysSince } from '../utils/dateOnly';
import {
  initialState,
  HEART_REFILL_MINUTES,
  MAX_HEARTS,
  NEW_USER_GRACE_HOURS,
  PERFECT_LESSON_BONUS_XP,
  getTodayDateString,
  getYesterdayDateString,
} from './appStateConstants';
import { ACTION_TYPES } from './appActionTypes';
import { sanitizePersistedState } from './stateHydration';

export function appReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.LOAD_STATE: {
      const sanitizedPayload = sanitizePersistedState(action.payload);
      const next = { ...state, ...sanitizedPayload, _loaded: true };
      const hasSubstantialProgress =
        (next.totalXP || 0) >= 50 ||
        Object.values(next.pathProgress || {}).reduce(
          (s, p) => s + (p?.completed?.length || 0),
          0,
        ) >= 3;
      const fakePastStamp = () =>
        new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

      if (!next.installedAt) {
        next.installedAt = hasSubstantialProgress
          ? fakePastStamp()
          : new Date().toISOString();
      } else if (hasSubstantialProgress) {
        const stampMs = new Date(next.installedAt).getTime();
        const stampRecent =
          !Number.isNaN(stampMs) &&
          Date.now() - stampMs < 24 * 60 * 60 * 1000;
        if (stampRecent) {
          next.installedAt = fakePastStamp();
        }
      }
      return next;
    }

    case ACTION_TYPES.COMPLETE_ONBOARDING:
      return { ...state, onboarded: true };

    case ACTION_TYPES.SET_USER_PROFILE:
      return { ...state, userProfile: action.payload };

    case ACTION_TYPES.SET_PREMIUM: {
      const premiumFreezeGrantClaimed =
        state.premiumFreezeGrantClaimed === true || !!action.payload;
      return {
        ...state,
        isPremium: !!action.payload,
        hearts: action.payload ? MAX_HEARTS : state.hearts,
        premiumFreezeGrantClaimed,
        streakFreezes: action.payload && !state.premiumFreezeGrantClaimed
          ? Math.max(state.streakFreezes || 0, 12)
          : state.streakFreezes,
      };
    }

    case ACTION_TYPES.USE_STREAK_FREEZE:
      if (state.streakFreezes <= 0) return state;
      return { ...state, streakFreezes: state.streakFreezes - 1 };

    case ACTION_TYPES.AUTO_APPLY_STREAK_FREEZE: {
      if ((state.currentStreak || 0) === 0) return state;
      const today = getTodayDateString();
      const yesterday = getYesterdayDateString();
      if (state.vacationUntil && state.vacationUntil >= today) {
        if (state.lastCompletedDate !== today && state.lastCompletedDate !== yesterday) {
          return { ...state, lastCompletedDate: yesterday };
        }
        return state;
      }
      if (
        state.vacationUntil
        && state.vacationUntil === yesterday
        && state.lastCompletedDate !== today
        && state.lastCompletedDate !== yesterday
      ) {
        return { ...state, lastCompletedDate: yesterday };
      }
      if ((state.streakFreezes || 0) <= 0) return state;
      if (state.lastCompletedDate === today) return state;
      if (state.lastCompletedDate === yesterday) return state;
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
        _streakFreezeToast: Date.now(),
      };
    }

    case ACTION_TYPES.CLEAR_STREAK_FREEZE_TOAST:
      return { ...state, _streakFreezeToast: null };

    case ACTION_TYPES.CLEAR_STREAK_LOST_INFO:
      return { ...state, _streakLostInfo: null };

    case ACTION_TYPES.SET_PATH_PLEDGE: {
      const { pathId, pledge } = action.payload || {};
      if (!pathId) return state;
      const cleaned = (pledge || '').trim();
      return {
        ...state,
        pathPledges: {
          ...(state.pathPledges || {}),
          [pathId]: cleaned || undefined,
        },
      };
    }

    case ACTION_TYPES.RESTORE_STREAK_FROM_REPAIR: {
      if (!state._streakLostInfo || !state._streakLostInfo.lost) return state;
      const restoredCount = state._streakLostInfo.lost;
      const yesterday = getYesterdayDateString();
      return {
        ...state,
        currentStreak: restoredCount,
        longestStreak: Math.max(state.longestStreak || 0, restoredCount),
        lastCompletedDate: yesterday,
        _streakLostInfo: null,
        streakRepairsUsed: (state.streakRepairsUsed || 0) + 1,
        _streakRepairToast: { restored: restoredCount, ts: Date.now() },
      };
    }

    case ACTION_TYPES.START_VACATION: {
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

    case ACTION_TYPES.GRANT_BONUS_XP: {
      const bonus = Math.max(0, Math.floor(action.payload?.xp || 0));
      if (!bonus) return state;
      const newTotalXP = (state.totalXP || 0) + bonus;
      const newLevel = checkLevelUp(newTotalXP, state.level || 1);
      return { ...state, totalXP: newTotalXP, level: newLevel };
    }

    case ACTION_TYPES.SET_DAILY_MOOD: {
      const today = getTodayDateString();
      return {
        ...state,
        dailyMoodCheckInDate: today,
        dailyMoodCheckInValue: action.payload?.mood || null,
      };
    }

    case ACTION_TYPES.OPEN_MYSTERY_BOX: {
      const today = getTodayDateString();
      if (state.dailyMysteryBoxOpenedAt === today) return state;
      const { rewardId, kind, value } = action.payload || {};
      let newTotalXP = state.totalXP || 0;
      let newLevel = state.level || 1;
      let newFreezes = state.streakFreezes || 0;
      if (kind === 'xp') {
        newTotalXP += value;
        newLevel = checkLevelUp(newTotalXP, newLevel);
      } else if (kind === 'freeze' || kind === 'streak_bonus') {
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

    case ACTION_TYPES.GRANT_REFERRAL_REWARD: {
      const rewardId = action.payload?.id;
      const ownerReward = action.payload?.beneficiary !== 'redeemer';
      const idsKey = ownerReward ? 'referralOwnerRewardIds' : 'referralRedeemerRewardIds';
      if (rewardId && (state[idsKey] || []).includes(rewardId)) {
        return state;
      }
      const current = state.streakFreezes || 0;
      const next = Math.min(50, current + 10);
      const rewardIds = rewardId
        ? Array.from(new Set([
            ...(state[idsKey] || []),
            rewardId,
          ])).slice(-200)
        : state[idsKey] || [];
      return { ...state, streakFreezes: next, [idsKey]: rewardIds };
    }

    case ACTION_TYPES.ENSURE_ANON_USERNAME: {
      if (state.anonUsername) return state;
      return { ...state, anonUsername: action.payload };
    }

    case ACTION_TYPES.DELETE_ACCOUNT:
      return { ...initialState, _loaded: true };

    case ACTION_TYPES.RESET_FOR_USER_SWITCH:
      return {
        ...initialState,
        onboarded: state.onboarded,
        stateOwnerUserId: typeof action.payload?.stateOwnerUserId === 'string'
          ? action.payload.stateOwnerUserId
          : null,
        _loaded: true,
      };

    case ACTION_TYPES.RESET_PROGRESS:
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
        _streakLostInfo: null,
        lastLessonAtMs: 0,
        todaySessionLessons: 0,
        _momentumToast: null,
        _lessonReward: null,
        streakRepairsUsed: 0,
        _milestoneToast: null,
        dailyDeckHistory: [],
        lastDailyDeckCompletedDate: null,
        dailyChallengeCompletedAt: null,
        dailyMysteryBoxOpenedAt: null,
        dailyMysteryBoxLastReward: null,
        dailyLoginGrantedAt: null,
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
      if (state.isPremium) return state;
      if (state.installedAt) {
        const installedMs = new Date(state.installedAt).getTime();
        if (!Number.isNaN(installedMs)) {
          const ageMs = Date.now() - installedMs;
          if (ageMs < NEW_USER_GRACE_HOURS * 60 * 60 * 1000) {
            return state;
          }
        }
      }
      const newHearts = Math.max(0, state.hearts - 1);
      const refillAt =
        newHearts < MAX_HEARTS && !state.heartsRefillAt
          ? new Date(Date.now() + HEART_REFILL_MINUTES * 60 * 1000).toISOString()
          : state.heartsRefillAt;
      return { ...state, hearts: newHearts, heartsRefillAt: refillAt };
    }

    case ACTION_TYPES.REFILL_HEARTS:
      return { ...state, hearts: MAX_HEARTS, heartsRefillAt: null };

    case ACTION_TYPES.GAIN_HEART: {
      const newHearts = Math.min(MAX_HEARTS, (state.hearts || 0) + 1);
      const refillAt = newHearts >= MAX_HEARTS ? null : state.heartsRefillAt;
      return { ...state, hearts: newHearts, heartsRefillAt: refillAt };
    }

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

      let xpMultiplier = 1;
      let comebackApplied = false;
      if (state.lastCompletedDate) {
        const daysSince = calendarDaysSince(state.lastCompletedDate);
        if (daysSince !== null && daysSince >= 3) {
          xpMultiplier *= 2;
          comebackApplied = true;
        }
      }
      const dow = new Date().getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend && state.isPremium) xpMultiplier *= 3;

      const isPerfectLesson =
        quizTotal > 0 && quizCorrect >= quizTotal;
      const perfectBonus = isPerfectLesson ? PERFECT_LESSON_BONUS_XP : 0;

      const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
      const nowMs = Date.now();
      const lastLessonSameDay = state.lastCompletedDate === today;
      const withinSessionWindow =
        state.lastLessonAtMs &&
        nowMs - state.lastLessonAtMs < SESSION_TIMEOUT_MS;
      const sessionLessonsBefore =
        lastLessonSameDay && withinSessionWindow
          ? state.todaySessionLessons || 0
          : 0;
      const sessionLessonsNow = sessionLessonsBefore + 1;
      let momentumBonus = 0;
      if (sessionLessonsNow === 2) momentumBonus = 25;
      else if (sessionLessonsNow === 3) momentumBonus = 50;
      else if (sessionLessonsNow === 4) momentumBonus = 75;
      else if (sessionLessonsNow >= 5) momentumBonus = 100;
      const momentumToast =
        momentumBonus > 0
          ? {
              chainCount: sessionLessonsNow,
              bonusXp: momentumBonus,
              ts: nowMs,
            }
          : state._momentumToast;

      const finalXp =
        Math.round(xp * xpMultiplier) + perfectBonus + momentumBonus;
      const newTotalXP = state.totalXP + finalXp;
      const newLevel = checkLevelUp(newTotalXP, state.level);

      let newStreak = state.currentStreak;
      let newLastDate = state.lastCompletedDate;
      let streakLostInfo = state._streakLostInfo || null;
      if (state.lastCompletedDate !== today) {
        const yesterday = getYesterdayDateString();
        if (state.lastCompletedDate === yesterday) {
          newStreak = state.currentStreak + 1;
        } else {
          if ((state.currentStreak || 0) >= 1) {
            streakLostInfo = {
              lost: state.currentStreak,
              previousLongest: state.longestStreak || 0,
              ts: Date.now(),
            };
          }
          newStreak = 1;
        }
        newLastDate = today;
      }

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
        lessonHistory: state.lessonHistory,
      });

      const MILESTONES = [7, 14, 30, 50, 100, 365];
      const hitMilestone = MILESTONES.includes(newStreak)
        && state.currentStreak !== newStreak;
      const milestoneToast = hitMilestone
        ? { streak: newStreak, comebackApplied, ts: Date.now() }
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
        _streakLostInfo:
          streakLostInfo !== state._streakLostInfo
            ? streakLostInfo
            : null,
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
        lastLessonAtMs: nowMs,
        todaySessionLessons: sessionLessonsNow,
        _momentumToast: momentumToast,
        _lessonReward: {
          totalXp: finalXp,
          baseXp: xp,
          multiplier: xpMultiplier,
          perfectBonus,
          momentumBonus,
          comebackApplied,
          weekendBoostApplied: isWeekend && state.isPremium,
          ts: nowMs,
        },
      };
    }

    case ACTION_TYPES.CLEAR_MOMENTUM_TOAST:
      return { ...state, _momentumToast: null };

    case ACTION_TYPES.SET_BASELINE_ASSESSMENT: {
      const { scores } = action.payload || {};
      if (!scores) return state;
      return {
        ...state,
        baselineAssessment: { ts: Date.now(), scores },
      };
    }

    case ACTION_TYPES.RECORD_DAILY_DECK: {
      const { deckId, response, actionCommitted } = action.payload || {};
      if (!deckId) return state;
      const today = getTodayDateString();
      const entry = {
        deckId,
        ts: Date.now(),
        date: today,
        response: (response || '').trim(),
        actionCommitted: !!actionCommitted,
      };
      const history = [...(state.dailyDeckHistory || []), entry].slice(-60);
      return {
        ...state,
        dailyDeckHistory: history,
        lastDailyDeckCompletedDate: today,
      };
    }

    case ACTION_TYPES.ADD_ASSESSMENT: {
      const { scores } = action.payload || {};
      if (!scores) return state;
      const entry = { ts: Date.now(), scores };
      const history = [...(state.assessmentHistory || []), entry].slice(-12);
      return {
        ...state,
        assessmentHistory: history,
        latestAssessment: entry,
      };
    }

    default:
      return state;
  }
}
