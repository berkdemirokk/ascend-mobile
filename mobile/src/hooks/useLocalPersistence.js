import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/constants';

export function useLocalPersistence({ state }) {
  const saveTimerRef = useRef(null);
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
    if (!state._loaded) return;
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
