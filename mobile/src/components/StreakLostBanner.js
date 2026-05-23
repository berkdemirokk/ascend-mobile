// Empathy banner that surfaces the FIRST time a user opens the app after
// losing a streak of >= 3 days. The audit found that the previous UX was
// "currentStreak silently drops to 1, no acknowledgement" — the cold-
// number-replacement is one of the strongest churn moments in any habit
// app. Duolingo's Streak Repair flow was built to soften this exact event.
//
// We don't try to restore the streak here (that lives in the upcoming
// Streak Repair flow, task #11). All we do is:
//   - Acknowledge the loss out loud ("you broke a 12-day chain, that
//     hurts but here's perspective")
//   - Surface the longest-streak record as evidence the user CAN do it
//   - Offer a one-tap restart CTA so the next-action friction is zero
//
// Dismissed by tapping × or by `clearStreakLostInfo` after the user
// completes a fresh lesson (handled upstream in COMPLETE_LESSON when a
// new streak starts forming).

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';

export default function StreakLostBanner({ info, onRestart, onDismiss }) {
  const { t } = useTranslation();
  if (!info || !info.lost) return null;

  const { lost, previousLongest } = info;

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <MaterialIcons
          name="favorite-border"
          size={18}
          color={LT.primaryContainer}
        />
        <Text style={styles.headerLabel}>
          {t('streakLost.label', 'ZİNCİRİN KIRILDI')}
        </Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
        >
          <MaterialIcons name="close" size={18} color={LT.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>
        {t('streakLost.title', '{{count}} günlük zincirini kaybettin.', {
          count: lost,
        })}
      </Text>

      <Text style={styles.body}>
        {previousLongest && previousLongest > lost
          ? t(
              'streakLost.bodyWithRecord',
              'Geri dönenler %47. Sen daha önce {{best}} gün gittin — bu kişi hala sende. Bugün başla.',
              { best: previousLongest },
            )
          : t(
              'streakLost.body',
              'Geri dönenler %47. Bugün başla — yarın sayı 2 olur.',
            )}
      </Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={onRestart}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>
          {t('streakLost.cta', 'YENİDEN BAŞLA')}
        </Text>
        <MaterialIcons name="arrow-forward" size={18} color={LT.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 18,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  headerLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.primaryContainer,
  },
  closeBtn: {
    padding: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: LT.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 12,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
});
