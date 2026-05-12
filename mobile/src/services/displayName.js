// Centralized "what to call the user" resolver. Threads through every
// surface that wants to address the user by name — Home greeting,
// notifications, lesson intros, reflection mirror, etc.
//
// Priority order (most-personal → least-personal):
//   1. userProfile.name      — what they typed in onboarding
//   2. supabase user_metadata.name — what came in from Apple sign-in / email
//   3. email local-part      — capitalized first segment of the email
//   4. anonUsername          — auto-generated for guests
//   5. localized "Disciplinci" / "Disciple" fallback
//
// All callers should use this, NOT raw userProfile.name access, so we
// can change the resolution logic in one place.

import { getCurrentLanguage } from '../i18n';

const LOCALE_FALLBACKS = {
  tr: 'Disiplinci',
  en: 'Disciple',
};

/** Capitalize the first letter of a string. Safe for undefined/null. */
const capitalize = (s) => {
  if (!s || typeof s !== 'string') return '';
  const trimmed = s.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * Resolve the user's display name from the available context.
 *
 * @param {Object} [ctx]
 * @param {Object} [ctx.userProfile]   AppContext userProfile object
 * @param {Object} [ctx.user]          supabase user (from useAuth)
 * @param {string} [ctx.anonUsername]  guest user's anon handle
 * @param {string} [ctx.fallback]      override for the i18n fallback
 * @returns {string} the name to display
 */
export const getDisplayName = (ctx = {}) => {
  const { userProfile, user, anonUsername, fallback } = ctx;

  // 1. Explicit userProfile.name
  const profileName = userProfile?.name?.trim();
  if (profileName) return profileName;

  // 2. supabase user_metadata.name
  const metaName = user?.user_metadata?.name?.trim();
  if (metaName) return metaName;

  // 3. email local-part
  const emailLocal = (user?.email || '').split('@')[0];
  if (emailLocal && emailLocal.length > 1) {
    return capitalize(emailLocal);
  }

  // 4. anonUsername (capitalize)
  if (anonUsername && String(anonUsername).trim()) {
    return capitalize(String(anonUsername).trim());
  }

  // 5. localized fallback
  if (fallback) return fallback;
  const lang = String(getCurrentLanguage() || 'tr').toLowerCase().slice(0, 2);
  return LOCALE_FALLBACKS[lang] || LOCALE_FALLBACKS.tr;
};

/**
 * Just the first name (for greeting). "Berk Demirok" → "Berk".
 * Falls through to whatever getDisplayName returned otherwise.
 */
export const getFirstName = (ctx = {}) => {
  const full = getDisplayName(ctx);
  if (!full) return full;
  return full.split(/\s+/)[0];
};
