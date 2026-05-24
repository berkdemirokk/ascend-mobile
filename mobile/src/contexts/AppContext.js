import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState } from 'react-native';
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
import { pullState, pushState, mergeStates, pickSyncableState } from '../services/cloudSync';
// `generateAnonUsername` is the only export still imported from the old
// leaderboard module — used as a default handle for the share card and
// Profile/Settings displays. The public leaderboard surface (screen +
// push-on-streak-change) was removed because a global ranking contradicts
// the "Monk Mode" framing of solo, intrinsic discipline. The Squad
// surface (private 2-5 person rings) was also removed because there was
// no inviteable user pool — solo users would see an empty squad UI and
// feel lonelier, not motivated.
import { generateAnonUsername } from '../services/leaderboard';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { redeemReferralCode, checkReferralRewards } from '../services/referral';
import {
  cancelAllNotifications,
  scheduleStreakAtRiskReminder,
  scheduleComebackReminder,
  cancelComebackReminder,
  registerPushToken,
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
  CLEAR_STREAK_LOST_INFO: 'CLEAR_STREAK_LOST_INFO',
  RESTORE_STREAK_FROM_REPAIR: 'RESTORE_STREAK_FROM_REPAIR',
  SET_PATH_PLEDGE: 'SET_PATH_PLEDGE',
  CLEAR_MOMENTUM_TOAST: 'CLEAR_MOMENTUM_TOAST',
  SET_BASELINE_ASSESSMENT: 'SET_BASELINE_ASSESSMENT',
  ADD_ASSESSMENT: 'ADD_ASSESSMENT',
  RECORD_DAILY_DECK: 'RECORD_DAILY_DECK',
  GRANT_REFERRAL_REWARD: 'GRANT_REFERRAL_REWARD',
  RESET_FOR_USER_SWITCH: 'RESET_FOR_USER_SWITCH',
  DELETE_ACCOUNT: 'DELETE_ACCOUNT',
  REFRESH_TODAY: 'REFRESH_TODAY',
  COMPLETE_PATH_LESSON: 'COMPLETE_PATH_LESSON',
  SET_ACTIVE_PATH: 'SET_ACTIVE_PATH',
  LOSE_HEART: 'LOSE_HEART',
  REFILL_HEARTS: 'REFILL_HEARTS',
  GAIN_HEART: 'GAIN_HEART',
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
};

function appReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.LOAD_STATE: {
      // Whitelist payload keys against initialState's shape — this
      // prevents fossil fields from prior versions (currentSquadId,
      // lastLetterShownAt, dailyMysteryBox*) from leaking into the new
      // state and getting pushed back up to the cloud on the next sync.
      // Without this, every cloud push would re-write the dead keys
      // forever, and a multi-device user would see them spread.
      const allowedKeys = Object.keys(initialState);
      const sanitizedPayload = {};
      for (const k of allowedKeys) {
        if (action.payload && Object.prototype.hasOwnProperty.call(action.payload, k)) {
          sanitizedPayload[k] = action.payload[k];
        }
      }
      const next = { ...state, ...sanitizedPayload, _loaded: true };
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

    case ACTION_TYPES.CLEAR_STREAK_LOST_INFO:
      // Dismiss the post-loss empathy banner. Called from HomeScreen
      // when the user taps the close (×) on the banner, OR implicitly
      // after they complete a fresh lesson (so it doesn't keep showing
      // forever after they've moved on).
      return { ...state, _streakLostInfo: null };

    case ACTION_TYPES.SET_PATH_PLEDGE: {
      // Self-authored sentence the user writes when committing to a
      // path. Stored per-pathId so a user with multiple paths can
      // have a separate pledge for each. Empty/whitespace-only
      // strings collapse to undefined so HomeScreen can use a simple
      // `if (pledge)` check.
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
      // Streak Repair flow: user watched a rewarded ad (verified by
      // the caller — we don't show the ad here). Restores the lost
      // streak by:
      //   1. Setting currentStreak back to the value we stashed in
      //      _streakLostInfo.lost
      //   2. Setting lastCompletedDate to YESTERDAY so today's next
      //      lesson naturally extends the streak by +1 — no parallel
      //      "completed today" lie.
      //   3. Clearing the empathy banner.
      // Bookkeeping: increment streakRepairsUsed so we can offer a
      // gentler limit for premium users later (e.g. 1 free/month) and
      // for analytics on how often this flow actually fires.
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
        // One-shot toast so the UI can confirm visually the restore worked.
        _streakRepairToast: { restored: restoredCount, ts: Date.now() },
      };
    }

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

    case ACTION_TYPES.GRANT_REFERRAL_REWARD: {
      // Redeemer + referrer both get +10 streak-freeze tokens when a
      // referral code is successfully redeemed. This was declared in
      // ACTION_TYPES + exposed as a dispatcher but the case was missing
      // — so SettingsScreen.handleRedeemCode and OnboardingScreen's
      // attemptReferralRedemption were silently no-op'ing the reward.
      // Capped at 50 to avoid runaway accumulation from any future
      // server-side referral airdrops.
      const current = state.streakFreezes || 0;
      const next = Math.min(50, current + 10);
      return { ...state, streakFreezes: next };
    }

    case ACTION_TYPES.ENSURE_ANON_USERNAME: {
      // Generate once, then sticky. cloudSync will replicate the chosen
      // handle across devices so the user stays the same monk.
      if (state.anonUsername) return state;
      return { ...state, anonUsername: action.payload };
    }

    case ACTION_TYPES.DELETE_ACCOUNT:
      return { ...initialState, _loaded: true };

    case ACTION_TYPES.RESET_FOR_USER_SWITCH:
      // Wipe everything user-specific when the authenticated user
      // changes (sign-out → sign-in as someone else, or guest →
      // sign-in). Without this, user A's totalXP / pathProgress /
      // achievements would bleed into user B's account via the
      // merge step in the cloud-pull effect, then get pushed back
      // to user B's row → cross-account data contamination.
      //
      // We preserve `onboarded` and `_loaded` so the user doesn't
      // get bounced back into the onboarding flow. Everything else
      // resets to initial. The next cloud-pull effect will fetch
      // user B's actual state.
      return {
        ...initialState,
        onboarded: state.onboarded,
        _loaded: true,
      };

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
        _streakLostInfo: null, // banner shouldn't survive an explicit reset
        // The momentum loop is per-session — leaving it set means the
        // first lesson of the new run could erroneously fire a "chain"
        // bonus from before the reset. Wipe.
        lastLessonAtMs: 0,
        todaySessionLessons: 0,
        _momentumToast: null,
        // Streak-repair / milestone bookkeeping is also progress-tied.
        streakRepairsUsed: 0,
        _milestoneToast: null,
        // Daily-deck + mystery-box + daily-login per-day flags reset so
        // the user can re-experience them as if fresh.
        dailyDeckHistory: [],
        lastDailyDeckCompletedDate: null,
        dailyChallengeCompletedAt: null,
        dailyMysteryBoxOpenedAt: null,
        dailyMysteryBoxLastReward: null,
        dailyLoginGrantedAt: null,
        // Assessment data is the user's measurement of self — keep it.
        // baselineAssessment / assessmentHistory NOT cleared on purpose.
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
      // First-24h grace period: free users in this window don't lose
      // hearts on wrong quiz answers. We previously gated this in
      // LessonScreen's caller, but other callers (PathScreen heart-cost
      // checks, future heart-debits) wouldn't have inherited the gate.
      // Moved into the reducer so the protection is universal.
      if (state.installedAt) {
        const installedMs = new Date(state.installedAt).getTime();
        if (!Number.isNaN(installedMs)) {
          const ageMs = Date.now() - installedMs;
          if (ageMs < NEW_USER_GRACE_HOURS * 60 * 60 * 1000) {
            return state; // grace period — no heart consumed
          }
        }
      }
      const newHearts = Math.max(0, state.hearts - 1);
      const refillAt =
        newHearts < 5 && !state.heartsRefillAt
          ? new Date(Date.now() + HEART_REFILL_MINUTES * 60 * 1000).toISOString()
          : state.heartsRefillAt;
      return { ...state, hearts: newHearts, heartsRefillAt: refillAt };
    }

    case ACTION_TYPES.REFILL_HEARTS:
      // Full refill — used by the time-based auto-refill (heartsRefillAt
      // expires) and explicit "all back" UX (none currently). The OutOfHearts
      // rewarded-ad path is NOT this — that uses GAIN_HEART below to add
      // exactly +1, matching the CTA text "+1 KALP KAZAN".
      return { ...state, hearts: 5, heartsRefillAt: null };

    case ACTION_TYPES.GAIN_HEART: {
      // Add exactly one heart. Used by the rewarded-ad reward flow so
      // the user gets what the button promised (+1), not a full top-up
      // back to 5 (which made the heart system feel meaningless — one
      // ad = unlimited hearts back). Cap at 5; if we now have 5, clear
      // the refill timer (no more refills pending).
      const newHearts = Math.min(5, (state.hearts || 0) + 1);
      const refillAt = newHearts >= 5 ? null : state.heartsRefillAt;
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

      // ── Bonus XP multipliers ──────────────────────────────────────────
      // Comeback bonus: returning after 3+ days gone gives 2x XP, once.
      // Random bonus days: Monday + Friday are 2x days. Stacks with
      // comeback (rare overlap = 4x — that's a feature, not a bug).
      let xpMultiplier = 1;
      let comebackApplied = false;
      if (state.lastCompletedDate) {
        const last = new Date(state.lastCompletedDate);
        const lastMs = last.getTime();
        // Guard against corrupt persisted state — older builds may have
        // written non-ISO strings here. NaN check prevents daysSince
        // becoming NaN which would silently disable comeback bonus.
        if (!Number.isNaN(lastMs)) {
          const daysSince = Math.floor((Date.now() - lastMs) / 86400000);
          if (daysSince >= 3) {
            xpMultiplier *= 2;
            comebackApplied = true;
          }
        }
      }
      const dow = new Date().getDay();
      const isBonusDay = dow === 1 || dow === 5; // Mon or Fri
      if (isBonusDay) xpMultiplier *= 2;

      // PREMIUM WEEKEND BOOST — Saturdays + Sundays grant a 3x
      // multiplier for premium users only. Visible on Home with a
      // banner so free users see the perk and feel the upgrade pull.
      // Stacks with the Mon/Fri 2x (impossible weekday overlap) and
      // the surprise 20% chance below — premium weekend can easily
      // hit 6x on a lucky lesson, which is the "wow" moment.
      const isWeekend = dow === 0 || dow === 6; // Sun or Sat
      if (isWeekend && state.isPremium) xpMultiplier *= 3;

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

      // ── Momentum / Chain bonus ────────────────────────────────────
      // A "session" is any sequence of lessons completed within
      // SESSION_TIMEOUT_MS of each other. The 2nd lesson in a row
      // grants +25 XP, the 3rd +50, the 4th +75, and the 5th+ +100.
      // This is the loop fix for the "5 min → close app" pattern: a
      // user who just finished lesson 1 sees a real reason to start
      // lesson 2 right now (XP × 2 stacking with the bonus). Same-
      // day-but-after-30-min counts as a fresh session — the bonus
      // is meant to reward marathoning, not all-day-trickle. Resets
      // also when the day rolls over (different YYYY-MM-DD).
      const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
      const nowMs = Date.now();
      const lastLessonSameDay =
        state.lastCompletedDate === today; // covered the day-roll case
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

      // Streak update — completing a lesson counts as today's action.
      // If the last completion was NOT yesterday (and not today), the
      // streak resets to 1. When that happens AND the user had a real
      // streak going (>= 3 days), we stash the old value in
      // `_streakLostInfo` so HomeScreen can show an empathy banner
      // instead of just silently showing "STREAK: 1" — the textbook
      // "streak loss" churn moment that Duolingo's Streak Repair UX
      // was built to soften. Cleared by CLEAR_STREAK_LOST_INFO.
      let newStreak = state.currentStreak;
      let newLastDate = state.lastCompletedDate;
      let streakLostInfo = state._streakLostInfo || null;
      if (state.lastCompletedDate !== today) {
        const yesterday = getYesterdayDateString();
        if (state.lastCompletedDate === yesterday) {
          newStreak = state.currentStreak + 1;
        } else {
          // Reset path. Record a "loss" event even for short streaks so
          // brand-new users (streak 1-2) also get the empathy banner —
          // the audit found they're the segment most at risk of churn
          // after a missed day, but were getting zero acknowledgement.
          // The banner copy still leans on `previousLongest` when it's
          // meaningfully larger than the just-lost count, so the message
          // stays honest for both veteran and rookie segments.
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
        // If a streak loss happened in THIS reducer run, we just set it
        // above. If the user is completing the NEXT lesson after seeing
        // the banner (i.e. coming back from a previous loss), the loss
        // record from before is no longer needed — clear it so the
        // banner doesn't keep showing while they're already rebuilding.
        _streakLostInfo:
          streakLostInfo !== state._streakLostInfo
            ? streakLostInfo // just set by this dispatch
            : null, // existing loss being cleared by a fresh completion
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
        // Momentum session bookkeeping — drives the chain-XP bonus
        // and the "Bugün X ders" badge on Home.
        lastLessonAtMs: nowMs,
        todaySessionLessons: sessionLessonsNow,
        _momentumToast: momentumToast,
      };
    }

    case ACTION_TYPES.CLEAR_MOMENTUM_TOAST:
      // Cleared by the celebration screen after surfacing the chain
      // bonus once. Keeps the toast from popping again on the same
      // dispatch tick if the screen re-renders.
      return { ...state, _momentumToast: null };

    case ACTION_TYPES.SET_BASELINE_ASSESSMENT: {
      // Onboarding-time baseline self-assessment. We deliberately
      // allow over-write here (re-onboarding the same install) but
      // ProgressReportScreen always computes delta vs THIS field,
      // so resetting baseline mid-journey wipes the comparison —
      // intentional, the user is starting over.
      const { scores } = action.payload || {};
      if (!scores) return state;
      return {
        ...state,
        baselineAssessment: { ts: Date.now(), scores },
      };
    }

    case ACTION_TYPES.RECORD_DAILY_DECK: {
      // Logs a completed daily deck. Lets HomeScreen hide the
      // "Bugünün Destesi" CTA after completion (to avoid the user
      // tapping into an already-done deck). The response text is
      // kept so the Reflections / Treasure surfaces can show it
      // alongside lesson reflections.
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
      // Post-baseline re-assessment. Appended to history so we can
      // chart progression over multiple 30-day cycles, but the
      // ProgressReportScreen only compares the latest vs baseline
      // for simplicity. History is kept trimmed at 12 entries
      // (1 year of monthly check-ins) so cloudSync payload doesn't
      // grow unbounded.
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

  // ── Save state to AsyncStorage (debounced) ────────────────────────
  // Audit finding: every dispatch triggered a full state serialize +
  // disk write. A single lesson with quiz + reflection could fire
  // 10+ writes in <30s; on the 60-second REFRESH_TODAY interval,
  // that adds up to constant flash wear plus latency spikes when the
  // disk is busy. We now coalesce writes inside a 600ms window — if
  // five dispatches land back-to-back, we serialize once.
  const saveTimerRef = useRef(null);
  // Latest state ref — read inside the AppState listener so it can
  // force-flush the most recent value without re-creating the listener
  // on every state change (which would also leak listeners).
  const latestStateRef = useRef(state);
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const flushSaveNow = useCallback(() => {
    const cur = latestStateRef.current;
    if (!cur || !cur._loaded) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const toSave = { ...cur };
    delete toSave._loaded;
    delete toSave._streakFreezeToast;
    delete toSave._milestoneToast;
    delete toSave._momentumToast;
    try {
      AsyncStorage.setItem(
        STORAGE_KEYS.USER_STATE,
        JSON.stringify(toSave),
      ).catch((e) => console.error('[AppContext] Failed to save state:', e));
    } catch (e) {
      console.error('[AppContext] Failed to serialize state:', e);
    }
  }, []);

  useEffect(() => {
    if (!state._loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const toSave = { ...state };
      delete toSave._loaded;
      delete toSave._streakFreezeToast;
      delete toSave._milestoneToast;
      delete toSave._momentumToast;
      // _streakLostInfo IS persisted: we want the empathy banner to
      // survive an app restart so a user who closes the app right
      // after losing their streak still sees it on the next open.
      try {
        AsyncStorage.setItem(
          STORAGE_KEYS.USER_STATE,
          JSON.stringify(toSave),
        ).catch((e) =>
          console.error('[AppContext] Failed to save state:', e),
        );
      } catch (e) {
        console.error('[AppContext] Failed to serialize state:', e);
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  // App-background flush — without this, any pending debounced write
  // is silently dropped if the OS kills the app while backgrounded.
  // User's most recent mutation (e.g. just-completed lesson) would be
  // lost on next launch. Fires whenever the app transitions away from
  // 'active' so we cover both background and inactive (incoming call,
  // notification center pull-down).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') flushSaveNow();
    });
    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, [flushSaveNow]);

  // ── User switch detector ──────────────────────────────────────────────
  // Tracks the last userId we've synced with. When it changes (sign-in,
  // sign-out, sign-in-as-someone-else), we MUST reset in-memory state
  // before the cloud-pull/merge runs — otherwise user A's progress
  // bleeds into user B's account via merge, then gets pushed back to
  // user B's row. Cross-account data contamination. P0.
  const lastSeenUserIdRef = useRef(null);
  // Set to true once the cloud-pull-and-merge has completed for the
  // current userId. The cloud-push effect waits for this so it doesn't
  // push pre-merge state to the new user's cloud row.
  const pullCompletedRef = useRef(false);
  useEffect(() => {
    if (!state._loaded) return;
    if (lastSeenUserIdRef.current === userId) return;
    const previousUserId = lastSeenUserIdRef.current;
    lastSeenUserIdRef.current = userId;
    pullCompletedRef.current = false;
    // Only reset when we're switching to a DIFFERENT real user.
    // First-time hydration (previousUserId = null, userId = X) doesn't
    // need a reset — we just hydrated from disk and that's already
    // the previous-session user's state, which is fine.
    // BUT: if previousUserId was a real id and userId is now null
    // (sign-out) OR a different id (account switch), reset.
    if (previousUserId !== null && previousUserId !== userId) {
      dispatch({ type: ACTION_TYPES.RESET_FOR_USER_SWITCH });
    }
  }, [state._loaded, userId]);

  // ── Cloud pull on first sign-in ─────────────────────────────────────────
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const remote = await pullState(userId);
        if (cancelled) return;
        if (!remote) {
          // No remote state — still mark pull complete so the push
          // effect can begin (and create the row for this user).
          pullCompletedRef.current = true;
          return;
        }

        const local = { ...state };
        delete local._loaded;
        // Per-path merge — never drops progress from either side. See
        // services/cloudSync.js for the merge rules.
        const merged = mergeStates(local, remote);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: merged });
        pullCompletedRef.current = true;
      } catch (e) {
        console.warn('[AppContext] Cloud pull failed:', e?.message);
        // Open the push gate anyway after failure so the user can
        // still sync forward eventually.
        pullCompletedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state._loaded, isAuthenticated, userId]);

  // ── Cloud push debounced ────────────────────────────────────────────────
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    // Don't push until the cloud-pull-and-merge for THIS userId has
    // completed. Pushing before merge would overwrite the freshly-
    // signed-in user's cloud row with whatever was sitting in memory
    // (commonly a fragment of the previous user's state).
    if (!pullCompletedRef.current) return;
    const timer = setTimeout(() => {
      // Sanitize before push: `pickSyncableState` keeps only the
      // explicit SYNCED_KEYS allowlist, so fossil fields from removed
      // features (e.g. currentSquadId after Squad MVP was removed) can
      // never be re-written to the cloud row.
      const toPush = pickSyncableState(state);
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
        // null = couldn't determine (offline / RC outage). DO NOT
        // dispatch — keep the cached / current value. Otherwise a
        // paying user offline would be downgraded to free and hit
        // the paywall, even though they have a valid subscription.
        if (!cancelled && isPremium !== null) {
          dispatch({ type: ACTION_TYPES.SET_PREMIUM, payload: isPremium });
          // Cache last-known-good so cold-start can use it before
          // the network round-trip completes.
          try {
            await AsyncStorage.setItem(
              '@ascend/cached_premium',
              isPremium ? '1' : '0',
            );
          } catch {}
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

  // ── Owner-side referral rewards (close the viral loop) ────────────────
  // For every friend who has redeemed THIS user's code but where the
  // owner-side reward hasn't been paid yet, grant +10 streak freezes.
  // Fires on every auth + once at app open. The server marks the row
  // BEFORE we dispatch so an interrupted dispatch can be re-tried
  // safely (the marker is the source of truth, not the local count).
  useEffect(() => {
    if (!state._loaded || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await checkReferralRewards(userId);
        if (cancelled) return;
        for (let i = 0; i < granted; i++) {
          dispatch({ type: ACTION_TYPES.GRANT_REFERRAL_REWARD });
        }
      } catch (e) {
        console.warn('[AppContext] owner referral check failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state._loaded, userId]);

  // ── Pending referral redemption (guest-mode → signed-in handoff) ───────
  // A guest user who typed a friend's code during onboarding had no userId
  // to redeem against. We stashed the code in AsyncStorage; now that an
  // account exists, redeem it once and clean up.
  useEffect(() => {
    if (!state._loaded || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const pending = await AsyncStorage.getItem(
          '@ascend/pending_referral_code',
        );
        if (!pending || cancelled) return;
        const result = await redeemReferralCode(pending, userId);
        if (cancelled) return;
        // Whether it succeeded or failed (invalid / already-used), drop
        // the pending code — retrying forever would just spam the server.
        await AsyncStorage.removeItem('@ascend/pending_referral_code');
        if (result?.ok) {
          dispatch({ type: ACTION_TYPES.GRANT_REFERRAL_REWARD });
        }
      } catch (e) {
        console.warn('[AppContext] pending referral redeem failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state._loaded, userId]);

  // ── Push token registration ────────────────────────────────────────────
  // Once the user is signed in AND has at least one lesson completed
  // (proxy for "they accepted notifications during onboarding"), upsert
  // their Expo push token to public.push_tokens so the broadcast-push
  // Edge Function can target them. registerPushToken is internally a
  // no-op if permissions weren't granted, so it's safe to call eagerly.
  // We piggy-back on totalLessonsCompleted ticking up rather than
  // running on every auth render — that gives the push permission
  // dialog a chance to resolve first.
  useEffect(() => {
    if (!state._loaded || !userId) return;
    const completedCount = Object.values(state.pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    );
    if (completedCount < 1) return;
    registerPushToken(userId, supabase).catch(() => {});
    // Re-runs whenever the user finishes another lesson, which doubles
    // as a cheap "refresh stale tokens weekly" mechanism since active
    // users complete lessons regularly.
  }, [state._loaded, userId, state.pathProgress]);

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

  const clearStreakLostInfo = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_STREAK_LOST_INFO });
  }, []);

  const restoreStreakFromRepair = useCallback(() => {
    dispatch({ type: ACTION_TYPES.RESTORE_STREAK_FROM_REPAIR });
  }, []);

  const setPathPledge = useCallback((pathId, pledge) => {
    dispatch({
      type: ACTION_TYPES.SET_PATH_PLEDGE,
      payload: { pathId, pledge },
    });
  }, []);

  const clearMomentumToast = useCallback(() => {
    dispatch({ type: ACTION_TYPES.CLEAR_MOMENTUM_TOAST });
  }, []);

  const setBaselineAssessment = useCallback((scores) => {
    dispatch({
      type: ACTION_TYPES.SET_BASELINE_ASSESSMENT,
      payload: { scores },
    });
  }, []);

  const addAssessment = useCallback((scores) => {
    dispatch({ type: ACTION_TYPES.ADD_ASSESSMENT, payload: { scores } });
  }, []);

  const recordDailyDeckCompleted = useCallback((payload) => {
    dispatch({ type: ACTION_TYPES.RECORD_DAILY_DECK, payload });
  }, []);

  const grantReferralReward = useCallback(() => {
    dispatch({ type: ACTION_TYPES.GRANT_REFERRAL_REWARD });
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
      quizTotal = 0,   // ← was being dropped on the floor; perfect-lesson +10 XP never fired
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

  const gainHeart = useCallback(() => {
    dispatch({ type: ACTION_TYPES.GAIN_HEART });
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
    clearStreakLostInfo,
    restoreStreakFromRepair,
    setPathPledge,
    clearMomentumToast,
    setBaselineAssessment,
    addAssessment,
    recordDailyDeckCompleted,
    grantReferralReward,
    startVacation,
    endVacation,
    completeDailyChallenge,
    openMysteryBox,
    setDailyMood,
    grantBonusXP,
    clearMilestoneToast,
    deleteAccount,
    setActivePath,
    completePathLesson,
    loseHeart,
    refillHearts,
    gainHeart,
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
