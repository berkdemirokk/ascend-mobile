// WhatToDoCard — single Home block that picks the right "start a lesson"
// surface based on the user state. Replaces three previously stacked
// cards (DailyPlanCard + LessonQueueCard + Today's CTA inline section).
//
// Render priority:
//   1. All paths complete   → "🏆 Tamamlandı" celebration tile
//   2. Premium + has plan   → premium gradient daily-plan card (3 lessons)
//   3. Free user / no plan  → big prominent "today's lesson" CTA card
//
// Free user note: we previously also showed a small DailyPlan upsell
// card here, but it was redundant with the premium upsell at the bottom
// of Home. Now the upsell text inside the lesson queue card mentions it
// in a sub-line — same hook, half the visual weight.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS, LT_SPACING } from '../config/lightTheme';
import { PATHS, isPathComplete } from '../data/paths';
import { reasonKey } from '../services/dailyPlanGenerator';
import { hapticImpactMedium } from '../services/haptics';

export default function WhatToDoCard({
  isPremium,
  plan,
  currentLesson,
  activePath,
  pathProgress,
  onStartLesson,
  onViewPaths,
  onUpgradeTap,
}) {
  const { t } = useTranslation();

  // Detect "all done" — every path is complete.
  const allDone = useMemo(
    () => PATHS.every((p) => isPathComplete(p, pathProgress)),
    [pathProgress],
  );

  // ── State: all done ─────────────────────────────────────────────────
  if (allDone) {
    return (
      <View style={[styles.card, styles.cardAllDone]}>
        <Text style={styles.allDoneEmoji}>🏆</Text>
        <Text style={styles.allDoneTitle}>
          {t('home.allDone', 'Tüm dersleri tamamladın')}
        </Text>
        <Text style={styles.allDoneSub}>
          {t(
            'home.allDoneSub',
            'Yeni yola geçebilir veya tekrar pratiği yapabilirsin.',
          )}
        </Text>
        <TouchableOpacity
          style={[styles.ctaButton, styles.ctaButtonSecondary]}
          onPress={onViewPaths}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonTextSecondary}>
            {t('home.viewPaths', 'YOLLARA GÖZAT')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── State: premium + daily plan ─────────────────────────────────────
  if (isPremium && plan && plan.length > 0) {
    return (
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.premiumCard}
      >
        <View style={styles.premiumHeader}>
          <MaterialIcons name="auto-awesome" size={18} color="#FDE047" />
          <Text style={styles.premiumLabel}>
            {t('dailyPlan.label', "TODAY'S PLAN · CURATED FOR YOU")}
          </Text>
        </View>
        <View style={styles.lessonsList}>
          {plan.map((item, idx) => {
            const path = PATHS.find((p) => p.id === item.pathId);
            const pathName = t(
              `paths.${item.pathId}.shortTitle`,
              path?.shortTitle || item.pathId,
            );
            const lessonTitle = t(
              `lessons.${item.pathId}.${item.lessonOrder}.title`,
              `${pathName} · ${item.lessonOrder}`,
            );
            return (
              <TouchableOpacity
                key={item.lessonId}
                onPress={() => onStartLesson?.(item.pathId, item.lessonId)}
                activeOpacity={0.85}
                style={styles.planLessonRow}
              >
                <View style={styles.planLessonNum}>
                  <Text style={styles.planLessonNumText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLessonPath} numberOfLines={1}>
                    {pathName} · {t(reasonKey(item.reason))}
                  </Text>
                  <Text style={styles.planLessonTitle} numberOfLines={1}>
                    {lessonTitle}
                  </Text>
                </View>
                <MaterialIcons name="play-arrow" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
    );
  }

  // ── State: free / no plan — big single CTA ──────────────────────────
  const handleStart = () => {
    hapticImpactMedium();
    if (currentLesson) {
      onStartLesson?.(currentLesson.pathId, currentLesson.id);
    }
  };

  if (!currentLesson || !activePath) return null;

  const completed = pathProgress?.[activePath.id]?.completed?.length || 0;
  const total = activePath.duration;
  const progressPct = Math.min(100, (completed / total) * 100);
  const lessonTitleKey = `lessons.${currentLesson.pathId}.${currentLesson.order}.title`;
  const lessonSummaryKey = `lessons.${currentLesson.pathId}.${currentLesson.order}.summary`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>
          {t('home.todayCta', 'BUGÜNÜN GÖREVİ')}
        </Text>
        <View style={styles.pathBadge}>
          <MaterialIcons
            name={activePath.materialIcon}
            size={12}
            color={LT.onSurfaceVariant}
          />
          <Text style={styles.pathBadgeText}>
            {t(`paths.${activePath.id}.shortTitle`, activePath.id)}
          </Text>
        </View>
      </View>
      <Text style={styles.lessonTitle} numberOfLines={2}>
        {t(
          lessonTitleKey,
          `${t('path.lessonLabel', 'Ders')} ${currentLesson.order}`,
        )}
      </Text>
      <Text style={styles.lessonSummary} numberOfLines={2}>
        {t(
          lessonSummaryKey,
          t('home.ctaGenericSub', 'Bugünün adımı seni bekliyor. ~5 dakika.'),
        )}
      </Text>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completed} / {total}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaButtonText}>
          {t('home.startNow', 'PRATİĞE BAŞLA')}
        </Text>
        <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
      </TouchableOpacity>

      {/* Free-user nudge to surface the daily-plan premium feature without
          burning a full upsell card slot. Shown only when not premium. */}
      {!isPremium ? (
        <TouchableOpacity
          onPress={onUpgradeTap}
          activeOpacity={0.7}
          style={styles.upsellLink}
        >
          <MaterialIcons name="auto-awesome" size={12} color={LT.primary} />
          <Text style={styles.upsellLinkText}>
            {t(
              'dailyPlan.miniUpsell',
              'Premium ile 3 ders senin için seçilsin',
            )}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Free / default state
  card: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.onSurfaceVariant,
  },
  pathBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pathBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: LT.onSurfaceVariant,
  },
  lessonTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: LT.onSurface,
    lineHeight: 28,
    marginBottom: 6,
  },
  lessonSummary: {
    fontSize: 14,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: LT.outlineVariant,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: LT.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
    minWidth: 40,
    textAlign: 'right',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primaryContainer,
    borderRadius: 14,
    paddingVertical: 14,
  },
  ctaButtonText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  ctaButtonSecondary: {
    backgroundColor: LT.surfaceContainerLow,
  },
  ctaButtonTextSecondary: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  upsellLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  upsellLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: LT.primary,
    letterSpacing: 0.3,
  },

  // All-done celebration state
  cardAllDone: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  allDoneEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  allDoneTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 6,
  },
  allDoneSub: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  // Premium plan state
  premiumCard: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    padding: 16,
    borderRadius: LT_RADIUS.xl,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  premiumLabel: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  lessonsList: {
    gap: 10,
  },
  planLessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  planLessonNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(253, 224, 71, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLessonNumText: {
    color: '#FDE047',
    fontSize: 13,
    fontWeight: '900',
  },
  planLessonPath: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  planLessonTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
