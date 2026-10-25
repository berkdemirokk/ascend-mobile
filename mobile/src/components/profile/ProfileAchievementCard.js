import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { ACHIEVEMENTS } from '../../config/achievements';
import { LT, LT_RADIUS } from '../../config/lightTheme';

const ACHIEVEMENT_ICONS = {
  streak3: 'local-fire-department',
  streak7: 'local-fire-department',
  streak14: 'local-fire-department',
  streak30: 'workspace-premium',
  streak100: 'military-tech',
  lessons10: 'menu-book',
  lessons50: 'menu-book',
  lessons100: 'star',
  pathComplete: 'check-circle',
  perfectQuiz: 'verified',
};

export default function ProfileAchievementCard({ id, locked, onPress }) {
  const { t } = useTranslation();
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) return null;
  const iconName = ACHIEVEMENT_ICONS[id] || 'emoji-events';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.achCard, locked && styles.achCardLocked]}
    >
      <View
        style={[
          styles.achIconBox,
          locked && styles.achIconBoxLocked,
        ]}
      >
        <MaterialIcons
          name={locked ? 'lock' : iconName}
          size={28}
          color={locked ? LT.outline : LT.primaryContainer}
        />
      </View>
      <Text
        style={[styles.achTitle, locked && styles.achTitleLocked]}
        numberOfLines={2}
      >
        {t(`ach.${id}.title`, ach.title || id)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  achCard: {
    width: 110,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  achCardLocked: {
    backgroundColor: LT.surfaceContainerLow,
    opacity: 0.7,
  },
  achIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achIconBoxLocked: {
    backgroundColor: LT.surfaceContainer,
    borderColor: LT.outlineVariant,
  },
  achTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: LT.onSurface,
    textAlign: 'center',
    letterSpacing: 0,
  },
  achTitleLocked: {
    color: LT.outline,
  },
});
