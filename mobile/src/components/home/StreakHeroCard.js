import { View, Text, StyleSheet } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW, LT_SPACING } from '../../config/lightTheme';

export function StreakHeroCard({ currentStreak, longestStreak, onPress }) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={styles.streakHero}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.streakHeroLeft}>
        <Text style={styles.streakHeroLabel}>
          {t('home.currentStreak', 'MEVCUT SERİ')}
        </Text>
        <View style={styles.streakHeroNumberRow}>
          <Text style={styles.streakHeroNumber}>{currentStreak}</Text>
          <MaterialIcons
            name="local-fire-department"
            size={42}
            color={LT.primaryContainer}
          />
        </View>
        <Text style={styles.streakHeroSub}>
          {t('home.daysStrong', 'GÜN')}
        </Text>
      </View>
      <View style={styles.streakHeroRight}>
        <Text style={styles.streakBestLabel}>
          {t('home.longestStreak', 'EN UZUN')}
        </Text>
        <Text style={styles.streakBest}>{longestStreak || 0}</Text>
        <Text style={styles.streakBestSub}>
          {t('home.daysStrong', 'GÜN')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  streakHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    marginHorizontal: LT_SPACING.containerMargin,
    borderRadius: LT_RADII.xl,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    ...LT_SHADOW.ambient,
  },
  streakHeroLeft: {
    flex: 1,
  },
  streakHeroLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
    marginBottom: 4,
  },
  streakHeroNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakHeroNumber: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
    color: LT.onSurface,
    lineHeight: 52,
  },
  streakHeroSub: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: LT.primaryContainer,
    marginTop: 2,
  },
  streakHeroRight: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: LT.outlineVariant,
    paddingLeft: 20,
  },
  streakBestLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: LT.onSurfaceVariant,
    marginBottom: 4,
  },
  streakBest: {
    fontSize: 24,
    fontWeight: '900',
    color: LT.onSurface,
  },
  streakBestSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: LT.onSurfaceVariant,
  },
});
