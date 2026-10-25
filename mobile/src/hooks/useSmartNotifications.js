import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DAILY_REMINDER_ENABLED_KEY,
  scheduleDailyReminder,
  scheduleStreakAtRiskReminder,
  scheduleComebackReminder,
  cancelComebackReminder,
  registerPushToken,
} from '../services/notifications';
import { supabase } from '../services/supabase';
import { getTodayDateString } from '../contexts/appStateConstants';
import { DEFAULT_ARCHETYPE_ID, getArchetypeById } from '../data/archetypes';
import i18n from '../i18n/index';

export function useSmartNotifications({ state, userId }) {
  useEffect(() => {
    if (!state._loaded) return undefined;
    let cancelled = false;
    const refreshDailyReminder = async () => {
      const enabled = await AsyncStorage.getItem(DAILY_REMINDER_ENABLED_KEY);
      if (cancelled || enabled !== 'true') return;
      const archetype = getArchetypeById(
        state.userProfile?.archetype || DEFAULT_ARCHETYPE_ID,
      );
      await scheduleDailyReminder({
        currentStreak: state.currentStreak || 0,
        userName: state.userProfile?.name || state.userProfile?.answers?.name || '',
        archetypeName: archetype
          ? i18n.t(archetype.nameKey, archetype.nameFallback)
          : '',
        activePathId: state.activePathId || null,
      });
    };
    refreshDailyReminder().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    state._loaded,
    state.currentStreak,
    state.activePathId,
    state.userProfile?.name,
    state.userProfile?.answers?.name,
    state.userProfile?.archetype,
  ]);

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
    cancelComebackReminder().catch(() => {});
    scheduleComebackReminder({
      lastCompletedDate: state.lastCompletedDate,
    }).catch(() => {});
  }, [state._loaded, state.lastCompletedDate]);

  useEffect(() => {
    if (!state._loaded || !userId) return;
    const completedCount = Object.values(state.pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    );
    if (completedCount < 1) return;
    registerPushToken(userId, supabase).catch(() => {});
  }, [state._loaded, userId, state.pathProgress]);
}
