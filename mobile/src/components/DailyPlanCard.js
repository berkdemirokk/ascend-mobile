// DailyPlanCard — Premium-only "smart coach" home-screen card. Shows
// 3 lessons curated for the user today (signal sources: active path,
// reflection-dominant category, onboarding goal). Free users see a
// premium teaser card → tappable to Paywall.
//
// This is the visible "premium is qualitatively different" piece.
// Without it, premium = no ads + unlimited hearts (boring). With it,
// premium = a smart coach picking your day for you.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { PATHS } from '../data/paths';
import { hapticImpactMedium } from '../services/haptics';
import { reasonKey } from '../services/dailyPlanGenerator';

export default function DailyPlanCard({
  plan,
  isPremium,
  onStartLesson,
  onUpgradeTap,
}) {
  const { t } = useTranslation();

  // Free user — teaser version. Shows the lock + paywall CTA.
  if (!isPremium) {
    return (
      <TouchableOpacity
        onPress={() => {
          hapticImpactMedium();
          onUpgradeTap?.();
        }}
        activeOpacity={0.9}
        style={styles.upsellCard}
      >
        <View style={styles.upsellHeader}>
          <View style={styles.upsellIconBox}>
            <MaterialIcons name="auto-awesome" size={20} color={LT.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upsellEyebrow}>
              {t('dailyPlan.premiumLabel', 'PREMIUM · DAILY PLAN')}
            </Text>
            <Text style={styles.upsellTitle}>
              {t('dailyPlan.upsellTitle', 'Let the app build your day for you')}
            </Text>
            <Text style={styles.upsellSub}>
              {t('dailyPlan.upsellSub', '3 lessons picked for your mood + goals.')}
            </Text>
          </View>
        </View>
        <View style={styles.upsellCta}>
          <Text style={styles.upsellCtaText}>
            {t('dailyPlan.upsellCta', 'UNLOCK WITH PREMIUM')}
          </Text>
          <MaterialIcons name="arrow-forward" size={16} color={LT.primary} />
        </View>
      </TouchableOpacity>
    );
  }

  // Premium user — actual plan
  if (!plan || plan.length === 0) return null;

  return (
    <LinearGradient
      colors={['#1E1B4B', '#312E81', '#4338CA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <MaterialIcons name="auto-awesome" size={18} color="#FDE047" />
        <Text style={styles.label}>
          {t('dailyPlan.label', "TODAY'S PLAN · CURATED FOR YOU")}
        </Text>
      </View>

      <View style={styles.lessonsList}>
        {plan.map((item, idx) => {
          const path = PATHS.find((p) => p.id === item.pathId);
          const pathName = t(`paths.${item.pathId}.shortTitle`, path?.shortTitle || item.pathId);
          // Lesson keys in lessons.{tr,en}.json are nested
          // `lessons.<pathId>.<order>.title` — not the flat
          // `lessons.<pathId>-<order>.title` that the lesson IDs
          // themselves look like. Build the key path explicitly.
          const lessonTitle = t(
            `lessons.${item.pathId}.${item.lessonOrder}.title`,
            `${pathName} · ${item.lessonOrder}`,
          );
          return (
            <TouchableOpacity
              key={item.lessonId}
              onPress={() => onStartLesson?.(item.pathId, item.lessonId)}
              activeOpacity={0.85}
              style={styles.lessonRow}
            >
              <View style={styles.lessonNum}>
                <Text style={styles.lessonNumText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lessonPath} numberOfLines={1}>
                  {pathName} · {t(reasonKey(item.reason))}
                </Text>
                <Text style={styles.lessonTitle} numberOfLines={1}>
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

const styles = StyleSheet.create({
  // Free user upsell
  upsellCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.primary,
  },
  upsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upsellIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellEyebrow: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  upsellTitle: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  upsellSub: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  upsellCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LT.outlineVariant,
  },
  upsellCtaText: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Premium active plan
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  label: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  lessonsList: {
    gap: 10,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  lessonNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(253, 224, 71, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumText: {
    color: '#FDE047',
    fontSize: 13,
    fontWeight: '900',
  },
  lessonPath: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  lessonTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
