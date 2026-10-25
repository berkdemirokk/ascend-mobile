import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  redeemReferralCode,
  checkReferralRewards,
  markReferralRewardsPaid,
} from '../services/referral';
import { ACTION_TYPES } from '../contexts/appActionTypes';

export function useReferralSync({ state, userId, dispatch }) {
  // Owner-side referral rewards
  useEffect(() => {
    if (!state._loaded || !userId) return;
    let cancelled = false;
    let markTimer = null;
    (async () => {
      try {
        const { ids = [] } = await checkReferralRewards(userId);
        if (cancelled) return;
        const unpaidIds = ids.filter(
          (id) => !(state.referralOwnerRewardIds || []).includes(id),
        );
        unpaidIds.forEach((id) => {
          dispatch({
            type: ACTION_TYPES.GRANT_REFERRAL_REWARD,
            payload: { id },
          });
        });
        if (unpaidIds.length > 0) {
          markTimer = setTimeout(() => {
            markReferralRewardsPaid(unpaidIds).catch((e) =>
              console.warn('[useReferralSync] owner referral mark failed:', e?.message),
            );
          }, 1500);
        }
      } catch (e) {
        console.warn('[useReferralSync] owner referral check failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
      if (markTimer) clearTimeout(markTimer);
    };
  }, [state._loaded, userId, state.referralOwnerRewardIds, dispatch]);

  // Pending referral redemption (guest to auth handoff)
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
        if (result?.ok) {
          await AsyncStorage.removeItem('@ascend/pending_referral_code');
          dispatch({ type: ACTION_TYPES.GRANT_REFERRAL_REWARD });
        } else if (
          ['invalid', 'own_code', 'already_redeemed', 'already_used_a_code']
            .includes(result?.reason)
        ) {
          await AsyncStorage.removeItem('@ascend/pending_referral_code');
        }
      } catch (e) {
        console.warn('[useReferralSync] pending referral redeem failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state._loaded, userId, dispatch]);
}
