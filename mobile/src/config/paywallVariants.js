// Paywall A/B variants. Copy is resolved through i18n keys; this file
// only owns structural choices such as icons, badges, and feature sets.

import AsyncStorage from '@react-native-async-storage/async-storage';

const VARIANT_KEY = '@ascend/paywall_variant_v1';

export const PAYWALL_VARIANTS = {
  // Variant A: direct, discipline-focused.
  A: {
    id: 'A',
    headline: 'paywall.titleA',
    subheadline: 'paywall.subtitleA',
    heroEmoji: '🔥',
    showSocialProof: false,
    showCountdown: false,
    ctaText: 'paywall.ctaTrialA',
    features: ['hearts', 'paths', 'ads', 'sync', 'achievements'],
    bestValueBadge: 'paywall.bestValueA',
    yearlyHighlight: true,
  },

  // Variant B: urgency copy, without fake countdown or inflated social proof.
  B: {
    id: 'B',
    headline: 'paywall.titleB',
    subheadline: 'paywall.subtitleB',
    heroEmoji: '⚡',
    showSocialProof: false,
    showCountdown: false,
    ctaText: 'paywall.ctaTrialB',
    features: ['hearts', 'paths', 'ads', 'sync', 'achievements'],
    bestValueBadge: 'paywall.bestValueB',
    yearlyHighlight: true,
  },

  // Variant C: outcome-focused.
  C: {
    id: 'C',
    headline: 'paywall.titleC',
    subheadline: 'paywall.subtitleC',
    heroEmoji: '🧭',
    showSocialProof: false,
    showCountdown: false,
    ctaText: 'paywall.ctaTrialC',
    features: ['hearts', 'paths', 'ads', 'sync', 'achievements'],
    bestValueBadge: 'paywall.bestValueC',
    yearlyHighlight: true,
  },
};

const VARIANT_KEYS = ['A', 'B', 'C'];

async function pickVariantOnce() {
  try {
    const existing = await AsyncStorage.getItem(VARIANT_KEY);
    if (existing && PAYWALL_VARIANTS[existing]) return existing;

    const random = VARIANT_KEYS[Math.floor(Math.random() * VARIANT_KEYS.length)];
    await AsyncStorage.setItem(VARIANT_KEY, random);
    return random;
  } catch {
    return 'A';
  }
}

export async function getPaywallVariant() {
  const id = await pickVariantOnce();
  return PAYWALL_VARIANTS[id] || PAYWALL_VARIANTS.A;
}

export async function setPaywallVariant(id) {
  if (PAYWALL_VARIANTS[id]) {
    await AsyncStorage.setItem(VARIANT_KEY, id);
  }
}

export function logPaywallEvent(variantId, event, meta = {}) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log('[PAYWALL_AB]', JSON.stringify({
    variant: variantId,
    event,
    ...meta,
    ts: Date.now(),
  }));
}
