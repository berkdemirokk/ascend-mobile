import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import ProfileAchievementCard from './ProfileAchievementCard';
import { LT, LT_SPACING } from '../../config/lightTheme';

export default function ProfileAchievementsSection({
  recentAchievements = [],
  onSelectAchievement,
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.achievementsSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('profile.achievements', 'BAŞARIMLAR')}
        </Text>
        <TouchableOpacity activeOpacity={0.7} style={styles.seeAll}>
          <Text style={styles.seeAllText}>
            {t('profile.seeAll', 'TÜMÜ')}
          </Text>
          <MaterialIcons
            name="chevron-right"
            size={16}
            color={LT.primaryContainer}
          />
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementsRow}
      >
        {recentAchievements.map((a) => (
          <ProfileAchievementCard
            key={`${a.id}-${a.locked ? 'lock' : 'unlock'}`}
            id={a.id}
            locked={a.locked}
            onPress={() => onSelectAchievement(a)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  achievementsSection: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LT_SPACING.containerMargin,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurface,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.primaryContainer,
  },
  achievementsRow: {
    paddingHorizontal: LT_SPACING.containerMargin,
    gap: 10,
  },
});
