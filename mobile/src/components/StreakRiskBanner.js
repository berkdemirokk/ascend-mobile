// StreakRiskBanner — high-urgency Home-screen banner shown only when:
//   1. user has an active streak (>= 2 days) AND
//   2. today's lesson is NOT yet completed AND
//   3. evening hours (18:00+) — running out of day AND
//   4. user is not on vacation mode
//
// Loss-aversion psychology: making the impending streak loss visible
// before midnight gives the user a clear "do this now" prompt instead
// of waking up to a broken streak. Habit-app data consistently shows
// this evening prompt drives 30-40% of late-day sessions.

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { hapticImpactMedium } from '../services/haptics';

// Banner shows from this hour onward, until midnight.
const SHOW_FROM_HOUR = 18;

/**
 * Returns true if we should render the banner right now. Caller is
 * expected to pass current streak + today-completion flag; this
 * component handles the time + visibility logic.
 */
const shouldShow = ({ currentStreak, todayCompleted, onVacation }) => {
  if (todayCompleted) return false;
  if (onVacation) return false;
  if ((currentStreak || 0) < 2) return false;
  const hour = new Date().getHours();
  return hour >= SHOW_FROM_HOUR;
};

export default function StreakRiskBanner({
  currentStreak,
  todayCompleted,
  onVacation,
  onTapStart,
}) {
  const { t } = useTranslation();

  // Re-evaluate visibility every minute — covers the 18:00 crossover
  // without forcing a parent re-render. Cheap interval since we only
  // touch local state.
  const [visible, setVisible] = useState(() =>
    shouldShow({ currentStreak, todayCompleted, onVacation }),
  );
  useEffect(() => {
    setVisible(shouldShow({ currentStreak, todayCompleted, onVacation }));
    const id = setInterval(() => {
      setVisible(shouldShow({ currentStreak, todayCompleted, onVacation }));
    }, 60_000);
    return () => clearInterval(id);
  }, [currentStreak, todayCompleted, onVacation]);

  if (!visible) return null;

  // Hours-remaining text — caps at "1 hour" so we don't show "0 hours"
  // weirdly close to midnight.
  const hoursLeft = Math.max(1, 24 - new Date().getHours());

  const handleTap = () => {
    hapticImpactMedium();
    onTapStart?.();
  };

  return (
    <TouchableOpacity
      onPress={handleTap}
      activeOpacity={0.85}
      style={styles.banner}
    >
      <View style={styles.iconBox}>
        <Text style={styles.fireIcon}>🔥</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {t('streakRisk.title', { streak: currentStreak })}
        </Text>
        <Text style={styles.body}>
          {t('streakRisk.body', { hours: hoursLeft })}
        </Text>
      </View>
      <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626', // bold red — this is loss-aversion UI
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    // shadow nudges it forward so it doesn't disappear in the visual stack
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fireIcon: { fontSize: 28 },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  body: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
  },
});
