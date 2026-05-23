// Referral service — viral growth loop.
//
// Flow:
//   1. Every signed-in user has a STABLE referral code derived from their
//      auth UID. Stable = the same UID always produces the same code, so
//      we never accidentally hand the user two different codes across
//      sessions.
//   2. First time the user opens the Invite screen, ensureMyReferral()
//      inserts the (code, owner_user_id) row if it doesn't exist yet.
//      Idempotent — safe to call on every open.
//   3. User shares the code (Settings → Invite button → native share
//      sheet with deep-link OR plain code).
//   4. A new user enters the code during onboarding. redeemReferralCode
//      validates the code, marks the row redeemed_by = self, and the
//      caller dispatches the reward (10 streak freezes for both sides —
//      the owner side reward is granted on the next app open via
//      checkReferralRewards()).
//
// We do NOT use RevenueCat-side entitlement grants — that requires a
// server endpoint and complicates the flow. Streak freezes are
// client-state, dispatched via AppContext, which is enough for an MVP.

import { supabase, SUPABASE_CONFIGURED } from './supabase';

const TABLE = 'referrals';

/**
 * Deterministic code from a user UID. UUID first 4 chars + last 4 chars,
 * uppercase, hyphen-separated, prefixed "MONK-".
 * Example: "MONK-A1B2-9F8E" from UID "a1b2cd34-...-9f8e1234"
 *
 * Stable for the lifetime of the account. No randomness — same UID
 * always produces the same code, which matters if a user accidentally
 * opens Invite from two devices (both should see the same code).
 */
export const codeFromUserId = (userId) => {
  if (!userId) return null;
  const cleaned = String(userId).replace(/-/g, '').toUpperCase();
  if (cleaned.length < 8) return null;
  return `MONK-${cleaned.slice(0, 4)}-${cleaned.slice(-4)}`;
};

/**
 * Ensure the current user has a referral row. Idempotent — does nothing
 * if a row already exists for this user. Returns the user's code on
 * success, null on failure (Supabase down, no auth, etc.).
 */
export const ensureMyReferral = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return null;
  const code = codeFromUserId(userId);
  if (!code) return null;
  try {
    // upsert with onConflict on owner_user_id would be cleaner but we
    // don't have a unique constraint there (intentional — a user could
    // theoretically rotate codes). For now: select first, insert if
    // missing.
    const { data: existing } = await supabase
      .from(TABLE)
      .select('code')
      .eq('owner_user_id', userId)
      .maybeSingle();
    if (existing?.code) return existing.code;
    const { error } = await supabase.from(TABLE).insert({
      code,
      owner_user_id: userId,
    });
    if (error) {
      // Most likely cause: code collision with another user (shouldn't
      // happen — UID-derived — but if it does, log and bail without
      // corrupting state).
      console.warn('[referral] insert error:', error.message);
      return null;
    }
    return code;
  } catch (e) {
    console.warn('[referral] ensureMyReferral exception:', e?.message);
    return null;
  }
};

/**
 * Redeem a code as the current user. Returns:
 *   { ok: true, ownerUserId, alreadyRedeemed: false }   on first success
 *   { ok: false, reason: 'invalid' | 'own_code' | 'already_redeemed' |
 *                        'already_used_a_code' | 'auth_required' | 'error' }
 *
 * Caller is responsible for dispatching reward on { ok: true }.
 */
export const redeemReferralCode = async (rawCode, userId) => {
  if (!SUPABASE_CONFIGURED) return { ok: false, reason: 'error' };
  if (!userId) return { ok: false, reason: 'auth_required' };
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || code.length < 8) return { ok: false, reason: 'invalid' };

  try {
    // Find the row.
    const { data: row, error: findErr } = await supabase
      .from(TABLE)
      .select('id, owner_user_id, redeemed_by')
      .eq('code', code)
      .maybeSingle();
    if (findErr) return { ok: false, reason: 'error' };
    if (!row) return { ok: false, reason: 'invalid' };
    if (row.owner_user_id === userId) return { ok: false, reason: 'own_code' };
    if (row.redeemed_by) return { ok: false, reason: 'already_redeemed' };

    // Mark redemption. The RLS policy enforces redeemed_by = self.
    const { error: updateErr } = await supabase
      .from(TABLE)
      .update({
        redeemed_by: userId,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (updateErr) {
      // Most likely cause: user already redeemed a different code (one-
      // per-user unique constraint).
      if (
        updateErr.code === '23505' ||
        /unique/i.test(updateErr.message || '')
      ) {
        return { ok: false, reason: 'already_used_a_code' };
      }
      return { ok: false, reason: 'error' };
    }
    return { ok: true, ownerUserId: row.owner_user_id };
  } catch (e) {
    console.warn('[referral] redeem exception:', e?.message);
    return { ok: false, reason: 'error' };
  }
};

/**
 * Count how many people have redeemed this user's code. Powers the
 * "X arkadaşın katıldı" line in the Invite screen.
 */
export const getReferralStats = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return { redemptions: 0 };
  try {
    const { count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', userId)
      .not('redeemed_by', 'is', null);
    return { redemptions: count || 0 };
  } catch {
    return { redemptions: 0 };
  }
};

/**
 * Check for unrewarded owner-side referral redemptions and return how
 * many should be granted right now. Called on app open from AppContext;
 * the caller dispatches GRANT_REFERRAL_REWARD once per unrewarded row.
 *
 * The viral loop's owner side was DOCUMENTED but never implemented —
 * inviters were silently shortchanged while redeemers got their +10
 * freezes. This function closes that gap.
 *
 * Returns { granted: number } — how many rewards we marked as paid out
 * (caller should dispatch once per item). On any error or no-rows-
 * found, returns { granted: 0 } and never throws.
 */
export const checkReferralRewards = async (userId) => {
  if (!SUPABASE_CONFIGURED || !userId) return { granted: 0 };
  try {
    // Pull all redeemed rows owned by this user where the owner reward
    // hasn't been marked paid yet.
    const { data: rows, error: fetchErr } = await supabase
      .from(TABLE)
      .select('id')
      .eq('owner_user_id', userId)
      .not('redeemed_by', 'is', null)
      .is('owner_rewarded_at', null);
    if (fetchErr) {
      // Most likely: the owner_rewarded_at column doesn't exist yet on
      // older schemas. Log and bail — don't crash the app.
      console.warn('[referral] reward check fetch error:', fetchErr.message);
      return { granted: 0 };
    }
    if (!rows || rows.length === 0) return { granted: 0 };

    // Mark all of them as rewarded in one round-trip. We do this BEFORE
    // dispatching the local reward so that an interrupted dispatch can
    // be re-run safely (the marker is the source of truth, not the
    // local counter).
    const nowIso = new Date().toISOString();
    const ids = rows.map((r) => r.id);
    const { error: updateErr } = await supabase
      .from(TABLE)
      .update({ owner_rewarded_at: nowIso })
      .in('id', ids);
    if (updateErr) {
      console.warn('[referral] reward mark error:', updateErr.message);
      return { granted: 0 };
    }
    return { granted: rows.length };
  } catch (e) {
    console.warn('[referral] checkReferralRewards exception:', e?.message);
    return { granted: 0 };
  }
};
