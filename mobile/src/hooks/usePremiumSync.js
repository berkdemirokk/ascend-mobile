import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkPremiumStatus,
  linkPurchaseUser,
  unlinkPurchaseUser,
} from '../services/purchases';
import { ACTION_TYPES } from '../contexts/appActionTypes';

export function usePremiumSync({ userId, dispatch }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let purchaseIdentityReady = true;
      try {
        if (userId) {
          purchaseIdentityReady = await linkPurchaseUser(userId);
        } else {
          await unlinkPurchaseUser();
        }
      } catch (e) {
        purchaseIdentityReady = false;
        console.warn('[usePremiumSync] Purchase user link failed:', e?.message);
      }
      if (cancelled) return;
      if (userId && !purchaseIdentityReady) {
        return;
      }
      try {
        const isPremium = await checkPremiumStatus();
        if (!cancelled && isPremium !== null) {
          dispatch({ type: ACTION_TYPES.SET_PREMIUM, payload: isPremium });
          try {
            await AsyncStorage.setItem(
              '@ascend/cached_premium',
              isPremium ? '1' : '0',
            );
          } catch {}
        }
      } catch (e) {
        console.warn('[usePremiumSync] Premium check failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, dispatch]);
}
