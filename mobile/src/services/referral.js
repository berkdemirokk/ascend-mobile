import { supabase, SUPABASE_CONFIGURED } from './supabase';

const REQUEST_TIMEOUT_MS = 10000;
export const PENDING_REFERRAL_CODE_KEY = '@ascend/pending_referral_code';
export const isReferralCodeFormatValid = (rawCode) => (
  /^ASCEND-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/.test(String(rawCode || '').trim().toUpperCase())
);

async function withReferralTimeout(request) {
  let timer;
  try {
    return await Promise.race([
      request,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ error: new Error('Referral request timed out') }), REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export const ensureMyReferral = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return null;
  try {
    const { data, error } = await withReferralTimeout(supabase.rpc('ensure_my_referral', {
      p_expected_user_id: userId,
    }));
    if (error) throw error;
    return typeof data === 'string' ? data : null;
  } catch (e) {
    console.warn('[referral] ensureMyReferral failed:', e?.message);
    return null;
  }
};

// Only the database may look up another user's code and transition redemption.
// It locks the row, checks auth.uid(), and never exposes the referral graph.
export const redeemReferralCode = async (rawCode, userId) => {
  if (!SUPABASE_CONFIGURED) return { ok: false, reason: 'error' };
  if (!userId) return { ok: false, reason: 'auth_required' };
  const code = String(rawCode || '').trim().toUpperCase();
  if (!isReferralCodeFormatValid(code)) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    const { data, error } = await withReferralTimeout(supabase.rpc('redeem_referral_code', {
      p_code: code,
      p_expected_user_id: userId,
    }));
    if (error) throw error;
    if (!data || typeof data.ok !== 'boolean') throw new Error('Invalid referral response');
    return data;
  } catch (e) {
    console.warn('[referral] redeem failed:', e?.message);
    return { ok: false, reason: 'error' };
  }
};

export const getReferralStats = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return { redemptions: 0 };
  try {
    const { data: count, error } = await withReferralTimeout(supabase.rpc('get_my_referral_redemption_count'));
    if (error) throw error;
    return { redemptions: count || 0 };
  } catch (e) {
    console.warn('[referral] stats failed:', e?.message);
    return { redemptions: 0 };
  }
};

// Reading rewards does not consume them. The hook grants with a stable row ID,
// verifies that the local balance and receipt were persisted, then acknowledges.
export const checkReferralRewards = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return { granted: 0, ids: [] };
  try {
    const { data: ids, error } = await withReferralTimeout(supabase.rpc('get_referral_owner_reward_ids'));
    if (error) throw error;
    const cleanIds = (ids || []).filter(Boolean);
    return { granted: cleanIds.length, ids: cleanIds };
  } catch (e) {
    console.warn('[referral] reward check failed:', e?.message);
    return { granted: 0, ids: [] };
  }
};

export const markReferralRewardsPaid = async (ids = []) => {
  const cleanIds = Array.from(new Set(ids.filter(Boolean)));
  if (!SUPABASE_CONFIGURED || cleanIds.length === 0) return false;
  try {
    const { data, error } = await withReferralTimeout(supabase.rpc('mark_referral_rewards_paid', {
      p_ids: cleanIds,
    }));
    if (error) throw error;
    return Number.isInteger(data) && data >= 0;
  } catch (e) {
    console.warn('[referral] reward acknowledgement failed:', e?.message);
    return false;
  }
};
