import { useEffect } from 'react';
import {
  scheduleStreakAtRiskReminder,
  scheduleComebackReminder,
  cancelComebackReminder,
  registerPushToken,
} from '../services/notifications';
import { supabase } from '../services/supabase';
import { getTodayDateString } from '../contexts/appStateConstants';

export function useSmartNotifications({ state, userId }) {
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
