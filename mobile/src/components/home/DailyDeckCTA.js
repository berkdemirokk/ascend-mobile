import { View, Text, StyleSheet } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW, LT_SPACING } from '../../config/lightTheme';

export function DailyDeckCTA({ dailyDeckDone, onPress }) {
  const { t } = useTranslation();

  if (dailyDeckDone) {
    return (
      <View style={styles.deckDoneChip}>
        <MaterialIcons
          name="check-circle"
          size={14}
          color={LT.onSurfaceVariant}
        />
        <Text style={styles.deckDoneChipText}>
          {t('home.deckDone', 'Bonus deste tamamlandı')}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.deckCard}
    >
      <View style={styles.deckIconBox}>
        <MaterialIcons
          name="auto-awesome"
          size={20}
          color={LT.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.deckLabel}>
          {t('home.deckLabel', 'BONUS RİTÜEL · ~3 DK')}
        </Text>
        <Text style={styles.deckTitle}>
          {t(
            'home.deckTitle',
            'Bir fikir, dürüst bir soru, küçük bir hamle',
          )}
        </Text>
      </View>
      <MaterialIcons
        name="arrow-forward"
        size={18}
        color={LT.primary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    marginHorizontal: LT_SPACING.containerMargin,
    borderRadius: LT_RADII.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    ...LT_SHADOW.ambient,
  },
  deckIconBox: {
    width: 38,
    height: 38,
    borderRadius: LT_RADII.sm,
    backgroundColor: LT.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deckLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.primary,
    marginBottom: 2,
  },
  deckTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: LT.onSurface,
    lineHeight: 18,
  },
  deckDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: LT_SPACING.containerMargin,
    paddingVertical: 8,
    marginBottom: 12,
    borderRadius: LT_RADII.pill,
    backgroundColor: LT.surfaceContainerHigh,
  },
  deckDoneChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
  },
});
