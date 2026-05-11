// Weekend Boost Banner — visible Sat/Sun on Home to surface the
// premium-only 3x XP weekend multiplier. Premium users see "your boost
// is active". Free users see "premium users are earning 3x today" →
// tappable to Paywall. Either way, the perk is loud and clear, which
// is the whole point: turn premium from "kısıtlamasız" into "qualitative
// different experience".

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { hapticImpactMedium } from '../services/haptics';

const isWeekendNow = () => {
  const d = new Date().getDay();
  return d === 0 || d === 6;
};

export default function WeekendBoostBanner({ isPremium, onUpgradeTap }) {
  const { t } = useTranslation();
  if (!isWeekendNow()) return null;

  // Premium-active state — celebratory, gold gradient
  if (isPremium) {
    return (
      <LinearGradient
        colors={['#F59E0B', '#EF4444', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <Text style={styles.emoji}>🔥</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {t('weekendBoost.eyebrow', 'WEEKEND BOOST · ACTIVE')}
          </Text>
          <Text style={styles.titleLight}>
            {t('weekendBoost.activeTitle', 'All lessons today: 3× XP')}
          </Text>
        </View>
        <Text style={styles.boostBadge}>3×</Text>
      </LinearGradient>
    );
  }

  // Free user — upsell-style banner, neutral gradient with CTA
  const handleTap = () => {
    hapticImpactMedium();
    onUpgradeTap?.();
  };
  return (
    <TouchableOpacity onPress={handleTap} activeOpacity={0.9} style={styles.upsellWrap}>
      <View style={styles.upsell}>
        <Text style={styles.emoji}>🔥</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.upsellEyebrow}>
            {t('weekendBoost.eyebrowFree', 'WEEKEND BOOST · PREMIUM ONLY')}
          </Text>
          <Text style={styles.upsellTitle}>
            {t('weekendBoost.freeTitle', 'Premium users earn 3× XP today')}
          </Text>
        </View>
        <MaterialIcons name="arrow-forward" size={22} color={LT.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emoji: { fontSize: 30 },
  eyebrow: {
    color: '#FFFFFF',
    opacity: 0.88,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  titleLight: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  boostBadge: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  upsellWrap: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.primary,
    gap: 12,
  },
  upsellEyebrow: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  upsellTitle: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
