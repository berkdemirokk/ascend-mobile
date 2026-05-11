// CharacterHero — large profile-page "this is who you are now" display.
// The hero of the Profile screen. Shows the user's current visual stage
// (emoji + title + tagline) and progress toward the next stage. This is
// the identity-reinforcement piece that makes a user feel they've
// TRANSFORMED through the app, not just earned points.
//
// Identity > behavior (James Clear, Atomic Habits). The emoji is the
// VISUAL proof of identity. When a user sees themselves as "🧘 Monk"
// in their profile, they're far less likely to skip a day.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { LT } from '../config/lightTheme';
import {
  getCharacterStage,
  getNextCharacterStage,
} from '../config/characterEvolution';

export default function CharacterHero({ longestStreak }) {
  const { t } = useTranslation();
  const stage = getCharacterStage(longestStreak);
  const next = getNextCharacterStage(longestStreak);

  // Gentle breathing animation on the emoji — barely perceptible but
  // makes the character feel "alive" rather than static art.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const scale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const progressPct = next
    ? Math.min(
        100,
        Math.round(((longestStreak || 0) / next.stage.minStreak) * 100),
      )
    : 100;

  return (
    <LinearGradient
      colors={['#7C3AED', '#EF4444', '#F59E0B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.row}>
        <Animated.Text style={[styles.emoji, { transform: [{ scale }] }]}>
          {stage.emoji}
        </Animated.Text>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.eyebrow}>
            {t('character.youAre', 'YOU ARE NOW')}
          </Text>
          <Text style={styles.title}>{t(stage.titleKey)}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {t(stage.subtitleKey)}
          </Text>
        </View>
      </View>

      {next ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {t('character.nextStage', { stage: t(next.stage.titleKey) })}
            </Text>
            <Text style={styles.progressDays}>
              {t('character.daysAway', { days: next.daysAway })}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      ) : (
        <Text style={styles.maxedText}>
          {t('character.maxed', 'You have reached the highest form.')}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 80,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  eyebrow: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  progressBlock: {
    marginTop: 18,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: '#FFFFFF',
    opacity: 0.92,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  progressDays: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  maxedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
    opacity: 0.92,
    textAlign: 'center',
  },
});
