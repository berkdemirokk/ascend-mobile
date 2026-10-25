import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  redeemReferralCode,
  checkReferralRewards,
  markReferralRewardsPaid,
  PENDING_REFERRAL_CODE_KEY,
} from '../services/referral';
import { ACTION_TYPES } from '../contexts/appActionTypes';

export function useReferralSync({ state, userId, dispatch }) {
  const { t } = useTranslation();
  const ownerRewardIdsRef = useRef(state.referralOwnerRewardIds || []);
  useEffect(() => {
    ownerRewardIdsRef.current = state.referralOwnerRewardIds || [];
  }, [state.referralOwnerRewardIds]);

  // Owner-side referral rewards
  useEffect(() => {
    if (!state._loaded || !userId) return;
    let cancelled = false;
    let markTimer = null;
    (async () => {
      try {
        const { ids = [] } = await checkReferralRewards(userId);
        if (cancelled) return;
        const grantedIds = ids.filter((id) => !ownerRewardIdsRef.current.includes(id));
        grantedIds.forEach((id) => {
          dispatch({
            type: ACTION_TYPES.GRANT_REFERRAL_REWARD,
            payload: { id, beneficiary: 'owner' },
          });
        });
        if (ids.length > 0) {
          markTimer = setTimeout(async () => {
            const persistedIds = ids.filter((id) => ownerRewardIdsRef.current.includes(id));
            if (persistedIds.length > 0) {
              await markReferralRewardsPaid(persistedIds);
            }
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
  }, [state._loaded, userId, dispatch]);

  // Pending referral redemption (guest to auth handoff)
  useEffect(() => {
    if (!state._loaded || !userId) return;
    let cancelled = false;
    let retryTimer = null;
    const retryPendingRedemption = async () => {
      if (cancelled) return;
      try {
        const pending = await AsyncStorage.getItem(
          PENDING_REFERRAL_CODE_KEY,
        );
        if (!pending || cancelled) return;
        const result = await redeemReferralCode(pending, userId);
        if (cancelled) return;
        if (result?.ok) {
          dispatch({
            type: ACTION_TYPES.GRANT_REFERRAL_REWARD,
            payload: { id: result.rewardId, beneficiary: 'redeemer' },
          });
          // Let the debounced state snapshot persist before clearing the retry marker.
          retryTimer = setTimeout(() => AsyncStorage.removeItem(PENDING_REFERRAL_CODE_KEY), 1200);
          return;
        }
        const terminalReasons = [
          'invalid', 'own_code', 'already_redeemed', 'already_used_a_code', 'auth_required',
        ];
        if (terminalReasons.includes(result?.reason)) {
          await AsyncStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
          const messages = {
            invalid: t('settings.redeemInvalid', 'Kod geçersiz. Tekrar dene.'),
            own_code: t('settings.redeemOwnCode', 'Kendi kodunu kullanamazsın 🙂'),
            already_redeemed: t('settings.redeemAlreadyRedeemed', 'Bu kod zaten kullanılmış.'),
            already_used_a_code: t('settings.redeemAlreadyUsed', 'Daha önce bir davet kodu kullandın.'),
            auth_required: t('settings.redeemAuthRequired', 'Tekrar giriş yapıp kodu yeniden dene.'),
          };
          Alert.alert(t('settings.redeemErrorTitle', 'Hata'), messages[result.reason]);
          return;
        }
        const retryDelay = result?.reason === 'rate_limited' ? 60 * 60 * 1000 : 15000;
        retryTimer = setTimeout(retryPendingRedemption, retryDelay);
      } catch (e) {
        console.warn('[useReferralSync] pending referral redeem failed:', e?.message);
        retryTimer = setTimeout(retryPendingRedemption, 15000);
      }
    };
    retryPendingRedemption();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [state._loaded, userId, dispatch, t]);
}
