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
  scheduleNewUserNudges,
} from '../services/notifications';
import { getFirstName } from '../services/displayName';

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

  // ── Adaptive quiz (#2A) ───────────────────────────────────────────────
  // Per-question answer history. Keyed by lessonId; each value is an
  // array indexed by the question's order in the lesson's quiz array.
  //
  //   quizAnswers: {
  //     'dopamine-detox-1': [
  //       { correct: true,  attempts: 1, lastAt: '2026-05-13T...' },
  //       { correct: false, attempts: 2, lastAt: '...' },
  //     ],
  //     ...
  //   }
  //
  // Read by services/adaptiveQuiz.js to compute path-level accuracy and
  // pick "review" questions from prior lessons (preferring previously-
  // wrong answers — spaced repetition of weak spots).
  //
  // Coexists with pathProgress[pathId].quizCorrect (aggregate count);
  // quizAnswers is the per-question source of truth.
  quizAnswers: {},

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

  // Daily Mood Check-in (v1.0.12) — fresh mood signal captured each day
  // to refresh the personalization. The onboarding mood is a one-time
  // snapshot; this overrides it daily so the daily challenge actually
  // adapts to how the user feels today.
  dailyMoodCheckInDate: null,  // 'YYYY-MM-DD' of last check-in
  dailyMoodCheckInValue: null, // mood id: 'motivated' | 'fresh' | 'lost'

  // Daily login bonus — date the user last received +5 XP for opening the
  // app. Sticky-by-date, so the bonus fires once per calendar day.
  dailyLoginGrantedAt: null,

  // Daily Goal bonus — date the user last hit the 3-lesson daily target
  // and received the +50 XP bonus. Sticky-by-date so the bonus fires
  // exactly once per calendar day (and subsequent lessons on the same
  // day don't keep stacking it).
  dailyGoalBonusGrantedAt: null,

  // Streak Repair (#2A retention) — when a user with a streak ≥3 days
  // breaks it (missed yesterday) and finishes a lesson today, instead
  // of silently resetting to 1 we capture the broken streak and offer
  // a 48-hour restore window. Restore costs an ad watch (free) or a
  // streak-freeze token (premium with tokens). Highest-leverage habit-
  // app retention feature (Duolingo data: +15-20% D30).
  //
  // Shape: { brokenStreak: number, expiresAt: ISO }  or  null
  // Cleared when (a) user restores, (b) user dismisses, (c) expires.
  pendingStreakRestore: null,

  // "Your Why" — free-text statement the user typed for the reason
  // they're doing monk-mode. Pinned on Home as an emotional anchor.
  // Empty until the user opens the edit modal. Plain string; we trust
  // the user to keep it private and personal — not synced through any
  // analytics, only via cloudSync (their own devices).
  userWhy: null,

  // Custom Goal — user-defined personal goal tracked alongside the
  // curriculum. Plain-text intent ("Wake at 6 AM every morning"),
  // target day count, and a per-day check-in log. Surfaced on Home
  // as a dedicated card and in Settings as an editor. Deeper
  // personalization than path selection alone — the user names their
  // own monster.
  // Shape: {
  //   text: string,
  //   createdAt: ISO,
  //   targetDays: number,                       // 30 | 60 | 90 default
  //   checkIns: { 'YYYY-MM-DD': true },         // daily flag log
  //   lastCheckInDate: 'YYYY-MM-DD' | null,
  // }
  customGoal: null,

  // Last lesson completed milestone celebration shown — flag UI reads to
  // trigger confetti animation once per milestone.
  _milestoneToast: null,

  // Toast triggered when the user just hit the daily goal on this very
  // lesson completion. Cleared by the LessonScreen celebration once it
  // has surfaced the +50 XP pill so it doesn't re-fire on the next mount.
  _dailyGoalToast: null,

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

// Daily Goal — Duolingo-style "do N lessons today" target. The user sees
// a progress bar on Home and a "X/N" pill on the celebration screen.
// Hitting N grants a one-time bonus, tracked by date so it fires once
// per calendar day even if the user finishes more lessons after.
export const DAILY_GOAL_TARGET = 3;
const DAILY_GOAL_BONUS_XP = 50;

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
  SET_DAILY_MOOD: 'SET_DAILY_MOOD',
  GRANT_BONUS_XP: 'GRANT_BONUS_XP',
  GRANT_DAILY_LOGIN: 'GRANT_DAILY_LOGIN',
  CLEAR_MILESTONE_TOAST: 'CLEAR_MILESTONE_TOAST',
  CLEAR_DAILY_GOAL_TOAST: 'CLEAR_DAILY_GOAL_TOAST',
  RECORD_QUIZ_ANSWER: 'RECORD_QUIZ_ANSWER',
  RESTORE_BROKEN_STREAK: 'RESTORE_BROKEN_STREAK',
  DISMISS_BROKEN_STREAK_RESTORE: 'DISMISS_BROKEN_STREAK_RESTORE',
  SET_USER_WHY: 'SET_USER_WHY',
  SET_CUSTOM_GOAL: 'SET_CUSTOM_GOAL',
  CLEAR_CUSTOM_GOAL: 'CLEAR_CUSTOM_GOAL',
  CHECK_IN_CUSTOM_GOAL: 'CHECK_IN_CUSTOM_GOAL',
};

// Streak Repair threshold — only offer restore when the broken streak was
// substantial enough to be worth saving. Saves us from "you broke your
// 2-day streak" prompts that feel cheap. Tuned at 3 days (Duolingo: 3).
const STREAK_REPAIR_MIN_DAYS = 3;
// How long the user has to restore before the prompt expires.
const STREAK_REPAIR_WINDOW_HOURS = 48;

function appReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.LOAD_STATE: {
      const next = { ...state, ...action.payload, _loaded: true };
      // First-launch sentinel — stamp installedAt the very first time
      // we ever load state. We need to distinguish two cases:
      //
      //   (a) Genuinely new user: no XP, no lessons completed. Stamp
      //       installedAt to now — they get the legitimate 24h grace.
      //   (b) Existing user upgrading: they already have progress.
      //       Don't give them a retroactive grace period that hides
      //       the hearts mechanic they're used to. Stamp installedAt
      //       as a date well in the past so isInGracePeriod immediately
      //       reads false.
      //
      // Case (c) — fixup for Build 57 users: the prior fix only ran
      // when installedAt was missing. Users who had already loaded
      // Build 57 had it stamped to that load time, and Build 58 would
      // not retry the check. So we ALSO look at users who have an
      // installedAt that's < 24h old AND substantial progress —
      // that's the buggy combination — and reset.
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
        // Already stamped, but check if it was the Build 57 mistake:
        // recent stamp + meaningful progress = bogus, reset it.
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

    case ACTION_TYPES.GRANT_BONUS_XP: {
      // Generic XP grant for features that award bonuses outside the
      // lesson-completion path (Sage Mode completions, Mystery Box,
      // future referral rewards, etc.). Optional `source` tag is
      // ignored here but useful for future analytics.
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

    case ACTION_TYPES.SET_CUSTOM_GOAL: {
      // payload = { text, targetDays }. Either preserves the existing
      // checkIns log (if the user is editing their goal text) or starts
      // a fresh log (if there was no goal yet).
      const text = String(action.payload?.text || '').trim();
      if (!text) return state;
      const targetDays = Math.max(7, Math.min(365, action.payload?.targetDays || 30));
      const existing = state.customGoal || {};
      return {
        ...state,
        customGoal: {
          text,
          targetDays,
          createdAt: existing.createdAt || new Date().toISOString(),
          checkIns: existing.checkIns || {},
          lastCheckInDate: existing.lastCheckInDate || null,
        },
      };
    }

    case ACTION_TYPES.CLEAR_CUSTOM_GOAL:
      return { ...state, customGoal: null };

    case ACTION_TYPES.CHECK_IN_CUSTOM_GOAL: {
      // One-tap "I did it today" check-in. Idempotent for the day.
      if (!state.customGoal) return state;
      const today = getTodayDateString();
      if (state.customGoal.lastCheckInDate === today) return state;
      const checkIns = { ...(state.customGoal.checkIns || {}), [today]: true };
      return {
        ...state,
        customGoal: {
          ...state.customGoal,
          checkIns,
          lastCheckInDate: today,
        },
      };
    }

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
        quizTotal: {},
      };
      if (current.completed.includes(lessonId)) return state;

      // ── Bonus XP multipliers ──────────────────────────────────────────
      // Only TWO multipliers now (down from five). XP economy stays
      // legible — the user can actually predict their reward.
      //
      // 1. Comeback bonus: returning after 3+ days gone gives 2x once.
      //    Loud message-able trigger, ties to a real moment.
      // 2. Premium Weekend Boost: 3x on Sat/Sun (premium only).
      //    Loud banner on Home, drives upgrade signal.
      //
      // REMOVED (v1.0.14): Mon/Fri 2x and the 20% surprise random — both
      // were INVISIBLE rewards. The user got XP they couldn't anticipate
      // and couldn't repeat. Variable reward only works when paired with
      // a perceived event (crit hit's gold flash, mystery box opening) —
      // a silent number bump is noise, not dopamine.
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
      const isWeekend = dow === 0 || dow === 6; // Sun or Sat
      if (isWeekend && state.isPremium) xpMultiplier *= 3;

      // Perfect Lesson Bonus — completing every quiz question correctly
      // (i.e., not losing any hearts) earns a flat bonus. Makes the
      // heart system feel rewarding, not just punitive. Falls back to
      // false when quizTotal is unknown (legacy callers) or the lesson
      // had no quiz at all.
      const isPerfectLesson =
        quizTotal > 0 && quizCorrect >= quizTotal;
      const perfectBonus = isPerfectLesson ? PERFECT_LESSON_BONUS_XP : 0;

      // Daily Goal Bonus — when this completion is the 3rd lesson today,
      // grant a one-time +50 XP. Compare against the *post-increment*
      // count so the bonus fires when crossing the threshold (not after).
      // dailyGoalBonusGrantedAt guards against re-firing on the 4th, 5th…
      // lesson the same day. Also guards against a state shape where
      // lessonHistory is missing entirely.
      const newDailyLessonCount =
        ((state.lessonHistory || {})[today] || 0) + 1;
      const hitDailyGoal =
        newDailyLessonCount === DAILY_GOAL_TARGET
        && state.dailyGoalBonusGrantedAt !== today;
      const dailyGoalBonus = hitDailyGoal ? DAILY_GOAL_BONUS_XP : 0;

      const finalXp =
        Math.round(xp * xpMultiplier) + perfectBonus + dailyGoalBonus;
      const newTotalXP = state.totalXP + finalXp;
      const newLevel = checkLevelUp(newTotalXP, state.level);

      // Streak update — completing a lesson counts as today's action.
      //
      // Three branches:
      //   1. Already completed today → streak unchanged
      //   2. Last completion was yesterday → +1 (normal continuation)
      //   3. Last completion older → BREAK. Reset to 1 BUT if the broken
      //      streak was ≥3, capture it as pendingStreakRestore so the
      //      user gets a 48h "watch an ad to restore" prompt. Highest-
      //      leverage retention feature in habit apps (Duolingo: +15-20% D30).
      let newStreak = state.currentStreak;
      let newLastDate = state.lastCompletedDate;
      let pendingStreakRestore = state.pendingStreakRestore || null;
      if (state.lastCompletedDate !== today) {
        const yesterday = getYesterdayDateString();
        if (state.lastCompletedDate === yesterday) {
          newStreak = state.currentStreak + 1;
        } else {
          // Streak BROKE. If it was worth saving, offer restore.
          if (
            (state.currentStreak || 0) >= STREAK_REPAIR_MIN_DAYS
            && !pendingStreakRestore // don't overwrite an active restore window
          ) {
            pendingStreakRestore = {
              brokenStreak: state.currentStreak,
              expiresAt: new Date(
                Date.now() + STREAK_REPAIR_WINDOW_HOURS * 60 * 60 * 1000,
              ).toISOString(),
            };
          }
          newStreak = 1;
        }
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
            // Track per-lesson quiz length too so the adaptive coach
            // can compute accuracy (correct/total). Stored alongside
            // quizCorrect, idempotent — overwrites on re-completion.
            quizTotal: {
              ...(current.quizTotal || {}),
              [lessonId]: quizTotal || 0,
            },
          },
        },
        totalXP: newTotalXP,
        level: newLevel,
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak || 0, newStreak),
        lastCompletedDate: newLastDate,
        lessonHistory: {
          ...(state.lessonHistory || {}),
          [today]: newDailyLessonCount,
        },
        dailyGoalBonusGrantedAt: hitDailyGoal
          ? today
          : state.dailyGoalBonusGrantedAt,
        pendingStreakRestore,
        actionsSinceLastAd: (state.actionsSinceLastAd || 0) + 1,
        unlockedAchievements: [
          ...state.unlockedAchievements,
          ...newAchievements.filter((a) => !state.unlockedAchievements.includes(a)),
          ...newSpecials.filter((a) => !state.unlockedAchievements.includes(a)),
        ],
        _milestoneToast: milestoneToast,
        _dailyGoalToast: hitDailyGoal
          ? {
              target: DAILY_GOAL_TARGET,
              bonus: DAILY_GOAL_BONUS_XP,
              ts: Date.now(),
            }
          : state._dailyGoalToast,
      };
    }

    case ACTION_TYPES.CLEAR_DAILY_GOAL_TOAST:
      return { ...state, _dailyGoalToast: null };

    case ACTION_TYPES.RESTORE_BROKEN_STREAK: {
      // Restore the streak captured in pendingStreakRestore. Net result:
      // currentStreak = brokenStreak + 1 (the +1 = today's lesson the user
      // already completed when the restore prompt appeared).
      //
      // useToken: when true, decrement streakFreezes (premium path). When
      // false, the caller has already gated this on an ad watch (free path).
      // Defensive guard: refuse if pending is missing, expired, or — for
      // the token path — the user has no tokens left.
      const pending = state.pendingStreakRestore;
      if (!pending) return state;
      if (new Date(pending.expiresAt) < new Date()) {
        return { ...state, pendingStreakRestore: null };
      }
      const useToken = !!action.payload?.useToken;
      if (useToken && (state.streakFreezes || 0) <= 0) return state;
      const restored = (pending.brokenStreak || 0) + 1;
      return {
        ...state,
        currentStreak: restored,
        longestStreak: Math.max(state.longestStreak || 0, restored),
        streakFreezes: useToken
          ? state.streakFreezes - 1
          : state.streakFreezes,
        pendingStreakRestore: null,
      };
    }

    case ACTION_TYPES.DISMISS_BROKEN_STREAK_RESTORE:
      return { ...state, pendingStreakRestore: null };

    case ACTION_TYPES.SET_USER_WHY: {
      // Trim and cap length defensively. UI input is already capped but
      // a malformed cloudSync payload could exceed — guard at the
      // reducer boundary.
      const raw = action.payload?.text ?? null;
      const trimmed = typeof raw === 'string' ? raw.trim().slice(0, 280) : null;
      return { ...state, userWhy: trimmed || null };
    }

    case ACTION_TYPES.RECORD_QUIZ_ANSWER: {
      // Per-question answer log for the adaptive quiz engine. Always
      // overwrites the latest result for that (lesson, question) — the
      // newest attempt is what matters for "did the user actually
      // master this concept?". attempts is incremented to differentiate
      // first-try success from retries.
      const { lessonId, questionIndex, correct } = action.payload;
      if (!lessonId || typeof questionIndex !== 'number') return state;
      const all = state.quizAnswers || {};
      const lessonRecord = Array.isArray(all[lessonId])
        ? [...all[lessonId]]
        : [];
      const prior = lessonRecord[questionIndex] || { attempts: 0 };
      lessonRecord[questionIndex] = {
        correct: !!correct,
        attempts: (prior.attempts || 0) + 1,
        lastAt: new Date().toISOString(),
      };
      return {
        ...state,
        quizAnswers: { ...all, [lessonId]: lessonRecord },
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
    // Thread the user's first name into the push body for personality —
    // "Berk, you haven't completed today..." converts far better than
    // the generic copy. Falls through gracefully when name is unknown.
    const firstName = getFirstName({
      userProfile: state.userProfile,
      user,
      anonUsername: state.anonUsername,
      fallback: '',
    });
    scheduleStreakAtRiskReminder({
      todayCompleted: state.lastCompletedDate === today,
      currentStreak: state.currentStreak || 0,
      onVacation,
      firstName,
    }).catch(() => {});
  }, [
    state._loaded,
    state.lastCompletedDate,
    state.currentStreak,
    state.vacationUntil,
    state.userProfile,
    state.anonUsername,
    user,
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

  // ── New-user retention nudges (D2 first-lesson + D3 habit-forming) ─────
  // Re-evaluated on every state change to total-lessons / streak / install
  // age so the pushes self-cancel as soon as the user makes progress.
  // See services/notifications.js → scheduleNewUserNudges for the rules.
  useEffect(() => {
    if (!state._loaded) return;
    const totalCompleted = Object.values(state.pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    );
    scheduleNewUserNudges({
      installedAt: state.installedAt,
      currentStreak: state.currentStreak || 0,
      totalLessonsCompleted: totalCompleted,
    }).catch(() => {});
  }, [
    state._loaded,
    state.installedAt,
    state.currentStreak,
    state.pathProgress,
  ]);

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
    delete toSave._dailyGoalToast;
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
   * Generic bonus XP grant. Used by Sage Mode, Mystery Box, and any
   * other feature that awards XP outside the lesson-completion path.
   *
   * @param {number} xp     positive integer; negative/zero ignored
   * @param {string} [source] optional analytics tag (e.g. 'sageMode')
   */
  const grantBonusXP = useCallback((xp, source = null) => {
    dispatch({
      type: ACTION_TYPES.GRANT_BONUS_XP,
      payload: { xp, source },
    });
  }, []);

  /**
   * Set today's mood. Used by DailyMoodCheckIn to refresh the
   * personalization signal each day. Idempotent within a day.
   */
  const setDailyMood = useCallback((mood) => {
    if (!mood) return;
    dispatch({ type: ACTION_TYPES.SET_DAILY_MOOD, payload: { mood } });
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

  /**
   * Set (or update) the user's custom personal goal. The first call
   * stamps createdAt; subsequent calls preserve it and only change
   * text/targetDays — so editing the goal doesn't reset progress.
   *
   * @param {Object} goal
   * @param {string} goal.text         the goal description
   * @param {number} [goal.targetDays] target horizon (7..365, default 30)
   */
  const setCustomGoal = useCallback((goal) => {
    dispatch({ type: ACTION_TYPES.SET_CUSTOM_GOAL, payload: goal });
  }, []);

  const clearCustomGoal = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_CUSTOM_GOAL });
  }, []);

  /**
   * Mark today's custom-goal check-in. Idempotent per calendar day —
   * subsequent calls on the same day no-op so the UI can safely fire
   * on every tap.
   */
  const checkInCustomGoal = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CHECK_IN_CUSTOM_GOAL });
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
    ({
      pathId,
      lessonId,
      reflection,
      reflectionAudioUri,
      quizCorrect = 0,
      quizTotal = 0,
      xp = 15,
    }) => {
      dispatch({
        type: ACTION_TYPES.COMPLETE_PATH_LESSON,
        payload: {
          pathId,
          lessonId,
          reflection,
          reflectionAudioUri,
          quizCorrect,
          quizTotal,
          xp,
        },
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

  // Today's lesson count, used by Home daily-goal progress + the
  // celebration screen's "X / N" pill. Reads from lessonHistory (which
  // is keyed by 'YYYY-MM-DD') so it resets naturally at midnight.
  const dailyLessonsCount =
    (state.lessonHistory || {})[getTodayDateString()] || 0;

  const clearDailyGoalToast = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_DAILY_GOAL_TOAST });
  }, []);

  // Record a single quiz answer. Called by LessonScreen after the user
  // taps a quiz option (correct or wrong). Powers the adaptive engine
  // — see services/adaptiveQuiz.js for how it's read.
  const recordQuizAnswer = useCallback(({ lessonId, questionIndex, correct }) => {
    dispatch({
      type: ACTION_TYPES.RECORD_QUIZ_ANSWER,
      payload: { lessonId, questionIndex, correct },
    });
  }, []);

  // Streak Repair — caller is responsible for gating on the ad watch
  // (free) or token availability (premium). The reducer enforces the
  // expiry + token-count guards as a backstop.
  const restoreBrokenStreak = useCallback(({ useToken = false } = {}) => {
    dispatch({
      type: ACTION_TYPES.RESTORE_BROKEN_STREAK,
      payload: { useToken },
    });
  }, []);

  const dismissBrokenStreakRestore = useCallback(() => {
    dispatch({ type: ACTION_TYPES.DISMISS_BROKEN_STREAK_RESTORE });
  }, []);

  const setUserWhy = useCallback((text) => {
    dispatch({ type: ACTION_TYPES.SET_USER_WHY, payload: { text } });
  }, []);

  const value = {
    ...state,
    rank,
    completedPathsCount,
    totalLessonsCompleted,
    isInGracePeriod,
    dailyLessonsCount,
    dailyGoalTarget: DAILY_GOAL_TARGET,
    completeOnboarding,
    setUserProfile,
    setPremium,
    useStreakFreezeAction,
    clearStreakFreezeToast,
    startVacation,
    endVacation,
    completeDailyChallenge,
    openMysteryBox,
    setDailyMood,
    grantBonusXP,
    clearMilestoneToast,
    clearDailyGoalToast,
    recordQuizAnswer,
    restoreBrokenStreak,
    dismissBrokenStreakRestore,
    setUserWhy,
    setCustomGoal,
    clearCustomGoal,
    checkInCustomGoal,
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
