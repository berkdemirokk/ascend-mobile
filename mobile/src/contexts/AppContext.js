import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { getRank } from '../config/ranks';
import { getPathById } from '../data/paths';
import { generateAnonUsername } from '../services/anonymousHandle';
import { useAuth } from './AuthContext';
import { unlinkPurchaseUser } from '../services/purchases';
import { supabase } from '../services/supabase';
import { cancelAllNotifications } from '../services/notifications';
import { recordLessonCompletion, recordReflection } from '../services/cloudSync';

import { initialState, NEW_USER_GRACE_HOURS } from './appStateConstants';
import { ACTION_TYPES } from './appActionTypes';
import { appReducer } from './appReducer';

// Sub-hooks extracted during modularization
import { useHeartsSync } from '../hooks/useHeartsSync';
import { useLocalPersistence } from '../hooks/useLocalPersistence';
import { useCloudSync } from '../hooks/useCloudSync';
import { usePremiumSync } from '../hooks/usePremiumSync';
import { useSmartNotifications } from '../hooks/useSmartNotifications';
import { useReferralSync } from '../hooks/useReferralSync';

export { initialState, ACTION_TYPES, appReducer };

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [userSwitchResetNonce, bumpUserSwitchResetNonce] = useReducer(
    (value) => value + 1,
    0,
  );
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;

  // On load streak protection & daily login bonus
  useEffect(() => {
    if (!state._loaded) return;
    dispatch({ type: ACTION_TYPES.AUTO_APPLY_STREAK_FREEZE });
    dispatch({ type: ACTION_TYPES.GRANT_DAILY_LOGIN, payload: { bonusXp: 5 } });
  }, [state._loaded]);

  // Ensure anonymous profile handle
  useEffect(() => {
    if (!state._loaded) return;
    if (state.anonUsername) return;
    dispatch({
      type: ACTION_TYPES.ENSURE_ANON_USERNAME,
      payload: generateAnonUsername(),
    });
  }, [state._loaded, state.anonUsername]);

  // Modularized Domain Hooks
  useHeartsSync({ state, dispatch });
  useLocalPersistence({ state, dispatch });
  useCloudSync({
    state,
    dispatch,
    userId,
    isAuthenticated,
    userSwitchResetNonce,
    bumpUserSwitchResetNonce,
  });
  usePremiumSync({ userId, dispatch });
  useSmartNotifications({ state, userId });
  useReferralSync({ state, userId, dispatch });

  // Today refresh on date change (minute tick)
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: ACTION_TYPES.REFRESH_TODAY });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Action Creators
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

  const grantReferralReward = useCallback((id) => {
    dispatch({
      type: ACTION_TYPES.GRANT_REFERRAL_REWARD,
      payload: id ? { id, beneficiary: 'redeemer' } : undefined,
    });
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

  const grantBonusXP = useCallback((xp, source = null) => {
    dispatch({
      type: ACTION_TYPES.GRANT_BONUS_XP,
      payload: { xp, source },
    });
  }, []);

  const setDailyMood = useCallback((mood) => {
    if (!mood) return;
    dispatch({ type: ACTION_TYPES.SET_DAILY_MOOD, payload: { mood } });
  }, []);

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
    let serverOk = false;
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (!error) serverOk = true;
      else console.warn('delete-user function error:', error.message);
    } catch (e) {
      console.warn('delete-user invoke failed:', e?.message);
    }

    try {
      await unlinkPurchaseUser();
    } catch (e) {
      console.warn('unlinkPurchaseUser failed during deleteAccount:', e?.message);
    }

    try {
      await cancelAllNotifications();
    } catch {}

    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_STATE,
        STORAGE_KEYS.ONBOARDED,
        STORAGE_KEYS.AD_COUNTER,
      ]);
    } catch {}
    dispatch({ type: ACTION_TYPES.DELETE_ACCOUNT });

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

      if (user?.id) {
        recordLessonCompletion(user.id, {
          pathId,
          lessonId,
          xpAwarded: xp,
          critAwarded: false,
          quizCorrect,
          quizTotal,
        }).catch(() => {});

        if (reflection || reflectionAudioUri) {
          recordReflection(user.id, {
            pathId,
            lessonId,
            prompt: '',
            text: reflection || '',
            audioUri: reflectionAudioUri || null,
            actionCommitted: true,
          }).catch(() => {});
        }
      }
    },
    [user?.id],
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
    import('../services/paywallTrigger')
      .then((m) => m.resetPostLessonPaywallTrigger())
      .catch(() => {});
  }, []);

  // Derived state
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

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
