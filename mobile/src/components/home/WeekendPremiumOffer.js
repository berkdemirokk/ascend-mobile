import { View, Text, StyleSheet } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW, LT_SPACING } from '../../config/lightTheme';

export function WeekendPremiumOffer({ isWeekendOffer, isPremium, onPress }) {
  const { t } = useTranslation();

  if (!isWeekendOffer || isPremium) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.weekendOffer}
    >
      <View style={styles.weekendOfferBadge}>
        <Text style={styles.weekendOfferBadgeText}>
          {t('home.weekendDeal', 'HAFTA SONU')}
        </Text>
      </View>
      <Text style={styles.weekendOfferText}>
        {t(
          'home.weekendOfferBody',
          'Premium ile seri dondurucuları, sınırsız kalp ve reklamsız deneyim.',
        )}
      </Text>
      <MaterialIcons name="arrow-forward" size={18} color={LT.onPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  weekendOffer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.primary,
    marginHorizontal: LT_SPACING.containerMargin,
    borderRadius: LT_RADII.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    ...LT_SHADOW.ambient,
  },
  weekendOfferBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: LT_RADII.pill,
  },
  weekendOfferBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: LT.onPrimary,
  },
  weekendOfferText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: LT.onPrimary,
    lineHeight: 18,
  },
});
