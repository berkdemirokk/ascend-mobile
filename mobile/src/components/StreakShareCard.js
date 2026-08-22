// StreakShareCard — Instagram-Story-shaped card rendered off-screen,
// captured via react-native-view-shot, then shared.
// 9:16 aspect (1080x1920 conceptual), rendered at 360x640 device px.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Forward ref so streakShare service can call captureRef on the root view.
const StreakShareCard = React.forwardRef(function StreakShareCard(
  {
    streak = 0,
    longestStreak = 0,
    lessonsCompleted = 0,
    title = 'Ascend: Daily Discipline',
    subtitle = 'Disiplin. Odak. Tekrar.',
    streakLabel = 'GÜN',
    longestLabel = 'EN UZUN',
    lessonsLabel = 'DERS',
    appLabel = 'Ascend',
  },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient
        colors={['#0F0F14', '#1A0F30', '#3B2A6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        {/* Glow circle behind flame */}
        <View style={styles.glow} />

        <View style={styles.topBlock}>
          <Text style={styles.brand}>{appLabel}</Text>
          <Text style={styles.brandSub}>{title}</Text>
        </View>

        <View style={styles.flameBlock}>
          <Text style={styles.flame}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>{streakLabel}</Text>
        </View>

        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>{longestLabel}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{lessonsCompleted}</Text>
            <Text style={styles.statLabel}>{lessonsLabel}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ascend.app</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

export default StreakShareCard;

const CARD_W = 360;
const CARD_H = 640;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    overflow: 'hidden',
    borderRadius: 32,
  },
  bg: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glow: {
    position: 'absolute',
    top: CARD_H * 0.28,
    left: CARD_W * 0.5 - 130,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#FF6B35',
    opacity: 0.18,
  },
  topBlock: {
    alignItems: 'center',
    gap: 4,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  brandSub: {
    color: '#A0A0C0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  flameBlock: {
    alignItems: 'center',
    marginTop: 12,
  },
  flame: {
    fontSize: 96,
    marginBottom: 4,
  },
  streakNum: {
    color: '#FFFFFF',
    fontSize: 120,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 130,
    textShadowColor: 'rgba(255, 107, 53, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  streakLabel: {
    color: '#FFB088',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: -4,
  },
  subtitle: {
    color: '#E0E0F0',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 8,
  },
  statBox: {
    alignItems: 'center',
    minWidth: 80,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  statLabel: {
    color: '#9090B0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: '#7070A0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
