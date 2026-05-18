// LightTopAppBar — shared top bar for redesigned light-theme screens.
// Layout: avatar (left, taps Settings) + ASCEND brand (center) + streak counter (right).
//
// Used by: PathScreen, HomeScreen, StatsScreen, ProfileScreen.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS } from '../config/lightTheme';

/**
 * @param {object} props
 * @param {() => void} props.onAvatarPress
 * @param {() => void} props.onStreakPress
 * @param {number} props.currentStreak
 * @param {string} [props.brand] - override brand text (default "ASCEND")
 * @param {React.ReactNode} [props.rightContent] - optional override for the right side
 */
export default function LightTopAppBar({
  onAvatarPress,
  onStreakPress,
  currentStreak = 0,
  brand = 'ASCEND',
  rightContent = null,
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <TouchableOpacity
        onPress={onAvatarPress}
        style={styles.avatarBtn}
        accessibilityLabel={t('settings.title', 'Settings')}
        activeOpacity={0.7}
      >
        <View style={styles.avatarCircle}>
          <MaterialIcons
            name="person-outline"
            size={20}
            color={LT.onSurfaceVariant}
          />
        </View>
      </TouchableOpacity>

      <Text style={styles.brand}>{brand}</Text>

      {rightContent ? (
        rightContent
      ) : (
        <TouchableOpacity
          onPress={onStreakPress}
          style={styles.streakBtn}
          accessibilityLabel={`Streak ${currentStreak}`}
          activeOpacity={0.7}
        >
          <Text style={styles.streakNumber}>{currentStreak}</Text>
          <MaterialIcons
            name="local-fire-department"
            size={20}
            color={LT.primaryContainer}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    height: 64,
    backgroundColor: LT.surface,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 5,
    color: LT.onSurface,
    textTransform: 'uppercase',
  },
  streakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  streakNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: LT.primaryContainer,
    letterSpacing: -0.4,
  },
});
