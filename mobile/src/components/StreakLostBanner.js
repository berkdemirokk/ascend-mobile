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
} from 'react-native';
import {
  AccessibleTouchableOpacity as TouchableOpacity,
} from './AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';

export default function StreakLostBanner({
  info,
  onRestart,
  onDismiss,
  onRepair,
  repairAvailable, // false = hide the repair CTA for this user/context
  repairLoading = false,
}) {
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
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Kapat')}
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
              'Daha önce {{best}} gün gittin. Bu ritim sende var; bugün tek dersle yeniden başla.',
              { best: previousLongest },
            )
          : t(
              'streakLost.body',
              'Zincir kırıldı ama sistem bitmedi. Bugün tek dersle yeniden başla; yarın sayı 2 olur.',
            )}
      </Text>

      {/* Streak Repair — only shown when the rewarded-ad SDK is loaded
          (`repairAvailable`). Tapping fires the ad; on EARNED_REWARD
          the parent dispatches RESTORE_STREAK_FROM_REPAIR which puts
          the lost streak back as if yesterday had been completed. */}
      {repairAvailable ? (
        <TouchableOpacity
          style={[styles.repairCta, repairLoading && styles.repairCtaDisabled]}
          onPress={onRepair}
          disabled={repairLoading}
          activeOpacity={0.85}
        >
          <MaterialIcons
            name={repairLoading ? 'hourglass-empty' : 'restore'}
            size={16}
            color={repairLoading ? LT.onSurfaceVariant : LT.primary}
          />
          <Text
            style={[
              styles.repairCtaText,
              repairLoading && styles.repairCtaTextDisabled,
            ]}
          >
            {repairLoading ? t('streakLost.repairLoading', 'PREPARING AD...') : t(
              'streakLost.repairCta',
              'REKLAM İZLE → ZİNCİRİNİ GERİ KAZAN',
            )}
          </Text>
        </TouchableOpacity>
      ) : null}

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
  // Secondary, lower-emphasis CTA. Outlined (not filled) on purpose:
  // the primary action is still "start a fresh lesson"; the repair
  // is the harder, ad-gated option for users who *really* don't want
  // to lose the count.
  repairCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: LT.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  repairCtaText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.primary,
  },
  repairCtaDisabled: {
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainer,
    opacity: 0.75,
  },
  repairCtaTextDisabled: {
    color: LT.onSurfaceVariant,
  },
});
