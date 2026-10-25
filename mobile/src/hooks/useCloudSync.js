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
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

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

    const storedOwnerMismatch = userId
      && state.stateOwnerUserId
      && state.stateOwnerUserId !== userId;
    if ((previousUserId !== null && previousUserId !== userId) || storedOwnerMismatch) {
      resetPendingForUserRef.current = userId;
      dispatch({
        type: ACTION_TYPES.RESET_FOR_USER_SWITCH,
        payload: { stateOwnerUserId: userId },
      });
      bumpUserSwitchResetNonce();
      return;
    }
    resetPendingForUserRef.current = null;
  }, [state._loaded, state.stateOwnerUserId, userId, userSwitchResetNonce, dispatch, bumpUserSwitchResetNonce]);

  // Cloud pull on sign-in
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    if (resetPendingForUserRef.current === userId) return;
    let cancelled = false;
    let retryTimer = null;

    const pullCloudState = async () => {
      if (cancelled) return;
      try {
        const remote = await pullState(userId);
        if (cancelled) return;
        if (!remote) {
          pullCompletedRef.current = true;
          const local = { ...latestStateRef.current, stateOwnerUserId: userId };
          dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: local });
          delete local._loaded;
          const pushInitialState = async () => {
            if (cancelled) return;
            const initialPush = pickSyncableState({ ...latestStateRef.current, stateOwnerUserId: userId });
            const error = await pushState(userId, initialPush);
            if (error && !cancelled) {
              console.warn('[useCloudSync] Initial cloud push failed:', error.message);
              retryTimer = setTimeout(pushInitialState, 15000);
            }
          };
          pushInitialState().catch((e) => console.warn('[useCloudSync] Initial cloud push failed:', e?.message));
          return;
        }

        const local = { ...latestStateRef.current };
        delete local._loaded;
        const merged = mergeStates(local, remote);
        dispatch({ type: ACTION_TYPES.LOAD_STATE, payload: { ...merged, stateOwnerUserId: userId } });
        pullCompletedRef.current = true;
      } catch (e) {
        console.warn('[useCloudSync] Cloud pull failed:', e?.message);
        // Do not overwrite remote state until a read succeeds or confirms no row.
        pullCompletedRef.current = false;
        retryTimer = setTimeout(pullCloudState, 15000);
      }
    };
    pullCloudState();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [state._loaded, isAuthenticated, userId, userSwitchResetNonce, dispatch]);

  // Cloud push debounced
  useEffect(() => {
    if (!state._loaded || !isAuthenticated || !userId) return;
    if (!pullCompletedRef.current) return;
    let cancelled = false;
    let timer;
    const pushLatestState = async () => {
      if (cancelled || !pullCompletedRef.current) return;
      try {
        const error = await pushState(userId, pickSyncableState(latestStateRef.current));
        if (error && !cancelled) {
          console.warn('[useCloudSync] Cloud push failed:', error.message);
          timer = setTimeout(pushLatestState, 15000);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[useCloudSync] Cloud push failed:', error?.message);
          timer = setTimeout(pushLatestState, 15000);
        }
      }
    };
    timer = setTimeout(pushLatestState, 2000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [state, isAuthenticated, userId]);
}
