// TodayHeroCard — Home's primary status block. Combines three previously
// separate cards into one tighter unit:
//
//   1. Streak hero  (current streak number, longest streak)
//   2. 7-day habit chain (loss-aversion visual)
//   3. Daily goal progress (X/3 lessons today + bar)
//
// One card means the Home screen leads with a single "where you stand
// today" block instead of three stacked rows. Tap → opens streak info
// modal (same as old StreakHero behaviour).

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS, LT_SPACING } from '../config/lightTheme';

export default function TodayHeroCard({
  currentStreak = 0,
  longestStreak = 0,
  chainDays = [],
  dailyLessonsCount = 0,
  dailyGoalTarget = 3,
  onPress,
}) {
  const { t } = useTranslation();
  const safeCurrent = Math.max(0, Math.min(dailyLessonsCount, dailyGoalTarget));
  const safeTarget = Math.max(1, dailyGoalTarget);
  const goalDone = safeCurrent >= safeTarget;
  const goalPercent = (safeCurrent / safeTarget) * 100;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={styles.card}
    >
      {/* Top row — streak numbers */}
      <View style={styles.topRow}>
        <View style={styles.streakLeft}>
          <Text style={styles.smallLabel}>
            {t('home.currentStreak', 'MEVCUT SERİ')}
          </Text>
          <View style={styles.numRow}>
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <MaterialIcons
              name="local-fire-department"
              size={36}
              color={LT.primaryContainer}
            />
          </View>
          <Text style={styles.dayLabel}>
            {t('home.daysStrong', 'GÜN')}
          </Text>
        </View>
        <View style={styles.streakRight}>
          <Text style={styles.smallLabel}>
            {t('home.longestStreak', 'EN UZUN')}
          </Text>
          <Text style={styles.longestNumber}>{longestStreak}</Text>
          <Text style={styles.dayLabel}>
            {t('home.daysStrong', 'GÜN')}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* 7-day chain */}
      <View style={styles.chainRow}>
        {chainDays.map((d) => (
          <View
            key={d.key}
            style={[
              styles.chainDot,
              d.active && styles.chainDotActive,
              d.isToday && styles.chainDotToday,
              d.isToday && d.active && styles.chainDotTodayActive,
            ]}
          />
        ))}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Daily goal */}
      <View style={styles.goalRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.smallLabel}>
            {goalDone
              ? t('dailyGoal.doneLabel', 'GÜNLÜK HEDEF TAMAMLANDI')
              : t('dailyGoal.label', 'BUGÜNÜN HEDEFİ')}
          </Text>
          <Text style={styles.goalText}>
            {goalDone
              ? t('dailyGoal.doneTitle', '+50 XP bonus aldın 🎯')
              : t('dailyGoal.title', '{{current}}/{{target}} ders', {
                  current: safeCurrent,
                  target: safeTarget,
                })}
          </Text>
        </View>
        <MaterialIcons
          name={goalDone ? 'emoji-events' : 'flag'}
          size={20}
          color={goalDone ? '#B45309' : LT.primaryContainer}
        />
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${goalPercent}%` },
            goalDone && styles.barFillDone,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  streakLeft: {
    flex: 1.4,
  },
  streakRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: LT.outlineVariant,
    paddingLeft: 16,
  },
  smallLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.onSurfaceVariant,
    marginBottom: 4,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  streakNumber: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -2,
    color: LT.primaryContainer,
    lineHeight: 54,
  },
  longestNumber: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    color: LT.onSurface,
    marginTop: 2,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
    color: LT.outline,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: LT.outlineVariant,
    marginVertical: 14,
  },
  chainRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chainDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: LT.outlineVariant,
  },
  chainDotActive: {
    backgroundColor: LT.primary,
  },
  chainDotToday: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LT.primary,
    backgroundColor: 'transparent',
  },
  chainDotTodayActive: {
    backgroundColor: LT.primary,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  goalText: {
    fontSize: 15,
    fontWeight: '800',
    color: LT.onSurface,
    letterSpacing: -0.2,
  },
  barTrack: {
    height: 6,
    backgroundColor: LT.outlineVariant,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: LT.primaryContainer,
    borderRadius: 3,
  },
  barFillDone: {
    backgroundColor: '#F59E0B',
  },
});
