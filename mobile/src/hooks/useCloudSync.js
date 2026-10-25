import { useEffect, useRef } from 'react';
import { pullState, pushState, mergeStates, pickSyncableState } from '../services/cloudSync';
import { ACTION_TYPES } from '../contexts/appActionTypes';

export function useCloudSync({
  state,
  dispatch,
  userId,
  isAuthenticated,
  userSwitchResetNonce,
  bumpUserSwitchResetNonce,
}) {
  const lastSeenUserIdRef = useRef(null);
  const resetPendingForUserRef = useRef(null);
  const pullCompletedRef = useRef(false);

  // User switch detection
  useEffect(() => {
    if (!state._loaded) return;
    if (lastSeenUserIdRef.current === userId) {
      if (resetPendingForUserRef.current === userId) {
        resetPendingForUserRef.current = null;
      }
      return;
    }
    const previousUserId = lastSeenUserIdRef.current;
    lastSeenUserIdRef.current = userId;
    pullCompletedRef.current = false;

    if (previousUserId !== null && previousUserId !== userId) {
      resetPendingForUserRef.current = userId;
      dispatch({ type: ACTION_TYPES.RESET_FOR_USER_SWITCH });
      bumpUserSwitchResetNonce();
      return;
    }
    resetPendingForUserRef.current = null;
  }, [state._loaded, userId, userSwitchResetNonce, dispatch, bumpUserSwitchResetNonce]);

  // Cloud pull on sign-in
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    if (resetPendingForUserRef.current === userId) return;
    let cancelled = false;

    (async () => {
      try {
        const remote = await pullState(userId);
        if (cancelled) return;
        if (!remote) {
          pullCompletedRef.current = true;
          const local = { ...state };
          delete local._loaded;
          const initialPush = pickSyncableState(local);
          pushState(userId, initialPush).catch((e) =>
            console.warn('[useCloudSync] Initial cloud push failed:', e?.message),
          );
          return;
        }

        const local = { ...state };
        delete local._loaded;
        const merged = mergeStates(local, remote);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: merged });
        pullCompletedRef.current = true;
      } catch (e) {
        console.warn('[useCloudSync] Cloud pull failed:', e?.message);
        pullCompletedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state._loaded, isAuthenticated, userId, userSwitchResetNonce, dispatch]);

  // Cloud push debounced
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    if (!pullCompletedRef.current) return;
    const timer = setTimeout(() => {
      const toPush = pickSyncableState(state);
      pushState(userId, toPush).catch((e) =>
        console.warn('[useCloudSync] Cloud push failed:', e?.message),
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [state, isAuthenticated, userId]);
}
