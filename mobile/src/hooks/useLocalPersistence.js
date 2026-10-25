import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';
import { ACTION_TYPES } from '../contexts/appActionTypes';
import { sanitizePersistedState } from '../contexts/stateHydration';
import {
  MAX_HEARTS,
  LOCAL_STATE_LOAD_TIMEOUT_MS,
  getTodayDateString,
  withTimeout,
} from '../contexts/appStateConstants';

export function useLocalPersistence({ state, dispatch }) {
  const saveTimerRef = useRef(null);
  const latestStateRef = useRef(state);
  const canPersistRef = useRef(false);

  // Bootstrap: hydrate from AsyncStorage on initial mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await withTimeout(
          AsyncStorage.getItem(STORAGE_KEYS.USER_STATE),
          LOCAL_STATE_LOAD_TIMEOUT_MS,
          'AsyncStorage USER_STATE load',
        );
        if (raw) {
          const parsed = sanitizePersistedState(JSON.parse(raw));
          const today = getTodayDateString();
          const todayCompleted = parsed.lastCompletedDate === today;

          // Auto-refill hearts if past refillAt
          let hearts = parsed.hearts ?? MAX_HEARTS;
          let heartsRefillAt = parsed.heartsRefillAt;
          if (heartsRefillAt && new Date(heartsRefillAt) < new Date()) {
            hearts = MAX_HEARTS;
            heartsRefillAt = null;
          }

          canPersistRef.current = true;
          dispatch({
            type: ACTION_TYPES.LOAD_STATE,
            payload: { ...parsed, todayCompleted, hearts, heartsRefillAt },
          });
        } else {
          canPersistRef.current = true;
          dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: {} });
        }
      } catch (e) {
        // A timed-out/failed read does not mean storage is empty. Keep the
        // existing snapshot intact; a later launch can recover that progress.
        canPersistRef.current = false;
        console.warn('[useLocalPersistence] Failed to load local state:', e?.message);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: {} });
      }
    })();
  }, [dispatch]);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const flushSaveNow = useCallback(() => {
    const cur = latestStateRef.current;
    if (!cur || !cur._loaded || !canPersistRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const toSave = { ...cur };
    delete toSave._loaded;
    delete toSave._streakFreezeToast;
    delete toSave._milestoneToast;
    delete toSave._momentumToast;
    delete toSave._lessonReward;
    try {
      AsyncStorage.setItem(
        STORAGE_KEYS.USER_STATE,
        JSON.stringify(toSave),
      ).catch((e) => console.error('[useLocalPersistence] Failed to save state:', e));
    } catch (e) {
      console.error('[useLocalPersistence] Failed to serialize state:', e);
    }
  }, []);

  useEffect(() => {
    if (!state._loaded || !canPersistRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const toSave = { ...state };
      delete toSave._loaded;
      delete toSave._streakFreezeToast;
      delete toSave._milestoneToast;
      delete toSave._momentumToast;
      delete toSave._lessonReward;
      try {
        AsyncStorage.setItem(
          STORAGE_KEYS.USER_STATE,
          JSON.stringify(toSave),
        ).catch((e) =>
          console.error('[useLocalPersistence] Failed to save state:', e),
        );
      } catch (e) {
        console.error('[useLocalPersistence] Failed to serialize state:', e);
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

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

  return { flushSaveNow };
}
