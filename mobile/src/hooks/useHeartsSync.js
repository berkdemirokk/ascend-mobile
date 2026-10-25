import { useEffect } from 'react';
import { ACTION_TYPES } from '../contexts/appActionTypes';
import { MAX_HEARTS } from '../contexts/appStateConstants';

export function useHeartsSync({ state, dispatch }) {
  useEffect(() => {
    if (!state._loaded || state.isPremium) return;
    if ((state.hearts || 0) >= MAX_HEARTS || !state.heartsRefillAt) return;
    const refillAtMs = new Date(state.heartsRefillAt).getTime();
    if (Number.isNaN(refillAtMs)) return;
    const delay = Math.max(0, refillAtMs - Date.now());
    const timer = setTimeout(() => {
      dispatch({ type: ACTION_TYPES.REFILL_HEARTS });
    }, delay);
    return () => clearTimeout(timer);
  }, [state._loaded, state.isPremium, state.hearts, state.heartsRefillAt, dispatch]);
}
