// TransformationReportModal — full-screen "look how far you've come"
// report. Shown when the user is eligible (≥10 lessons + ≥7 days since
// install). Premium: free tier sees a teaser version with 2 stats +
// blurred preview of the rest; premium sees the full report with all
// stats and a share button.
//
// This is the v1.0.12 "knockout punch" — concrete proof the app worked.
// Habit apps live or die on "did this thing actually do something for
// me" feeling. Showing it explicitly is the retention magnet.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { PATHS } from '../data/paths';
import { hapticImpactMedium, hapticMilestone } from '../services/haptics';

export default function TransformationReportModal({
  visible,
  report,
  isPremium,
  onClose,
  onUpgradeTap,
}) {
  const { t } = useTranslation();
  if (!visible || !report) return null;

  // Share is now available for BOTH free and premium users.
  // Free users share headline stats only; premium share message can be
  // richer in a future iteration. The point: viral share is the cheapest
  // acquisition channel and gating it behind paywall was backwards.
  const handleShare = async () => {
    hapticImpactMedium();
    const lines = [
      t('transform.shareIntro', "I'm growing on Ascend: Monk Mode."),
      '',
      `🔥 ${t('transform.statLessons', { count: report.lessonsTotal })}`,
      `📅 ${t('transform.statActiveDays', { days: report.activeDays })}`,
      `⏱ ${t('transform.statHours', { hours: report.hoursOfDiscipline })}`,
      `🏆 ${t('transform.statLongestStreak', { days: report.longestStreak })}`,
      '',
      'https://apps.apple.com/app/id6761607644',
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // user dismissed — no-op
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <LinearGradient
        colors={['#0F0A1E', '#1E1B4B', '#3730A3']}
        style={styles.root}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topLabel}>
              {t('transform.topLabel', 'YOUR TRANSFORMATION')}
            </Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Hero header */}
            <View style={styles.hero}>
              <Text style={styles.heroEmoji}>📊</Text>
              <Text style={styles.heroTitle}>
                {t('transform.heroTitle', 'You are not the same person')}
              </Text>
              <Text style={styles.heroSub}>
                {t('transform.heroSub', 'The numbers from your journey so far.')}
              </Text>
            </View>

            {/* Headline stats — always shown (free + premium) */}
            <View style={styles.statRow}>
              <StatCard
                label={t('transform.statLessons', { count: report.lessonsTotal })}
                value={report.lessonsTotal}
                icon="check-circle-outline"
              />
              <StatCard
                label={t('transform.statHoursLabel', 'HOURS')}
                value={report.hoursOfDiscipline}
                icon="schedule"
              />
            </View>
            <View style={styles.statRow}>
              <StatCard
                label={t('transform.statActiveLabel', 'ACTIVE DAYS')}
                value={report.activeDays}
                icon="calendar-month"
              />
              <StatCard
                label={t('transform.statLongestLabel', 'LONGEST STREAK')}
                value={report.longestStreak}
                icon="local-fire-department"
              />
            </View>

            {/* Share button — visible to all users now. Viral share is
                the cheapest acquisition channel; gating it behind premium
                was backwards. Free user gets the headline stats + app
                link; premium gets the richer message inside handleShare. */}
            <TouchableOpacity
              onPress={handleShare}
              style={styles.shareBtn}
              activeOpacity={0.85}
            >
              <MaterialIcons name="ios-share" size={18} color="#1E1B4B" />
              <Text style={styles.shareBtnText}>
                {t('transform.shareCta', 'Share my transformation')}
              </Text>
            </TouchableOpacity>

            {/* Premium-gated deeper insights */}
            {isPremium ? (
              <>
                {report.totalReflectionWords > 0 ? (
                  <InsightCard
                    icon="edit-note"
                    title={t('transform.reflectTitle', 'Your inner work')}
                    body={t('transform.reflectBody', {
                      words: report.totalReflectionWords,
                    })}
                  />
                ) : null}

                {report.topReflectionTopics.length > 0 ? (
                  <InsightCard
                    icon="psychology"
                    title={t('transform.topicsTitle', 'What you reflect on most')}
                    body={report.topReflectionTopics
                      .map((c) => t(`transform.topic_${c}`, c))
                      .join(' · ')}
                  />
                ) : null}

                {report.moodShifted ? (
                  <InsightCard
                    icon="sentiment-satisfied-alt"
                    title={t('transform.moodTitle', 'Your inner state')}
                    body={t('transform.moodShiftBody', {
                      from: t(`onboarding.mood${capitalize(report.onboardingMood)}`),
                      to: t(`onboarding.mood${capitalize(report.recentMood)}`),
                    })}
                  />
                ) : null}

                {report.pathStats.length > 0 ? (
                  <InsightCard
                    icon="trail"
                    title={t('transform.pathsTitle', 'Where you walked')}
                    body={report.pathStats
                      .map((p) => {
                        const path = PATHS.find((x) => x.id === p.pathId);
                        const name = t(`paths.${p.pathId}.shortTitle`, path?.shortTitle || p.pathId);
                        return `${name}: ${p.completed}/${path?.duration || 50}`;
                      })
                      .join('  ·  ')}
                  />
                ) : null}

              </>
            ) : (
              // Free user — premium teaser
              <View style={styles.premiumGate}>
                <View style={styles.lockBlur}>
                  <MaterialIcons name="lock" size={28} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.lockTitle}>
                    {t('transform.premiumLockTitle', 'Deeper insights')}
                  </Text>
                  <Text style={styles.lockSub}>
                    {t(
                      'transform.premiumLockSub',
                      'Reflection word count, mood shift analysis, path-by-path progress, and a shareable card — unlock with Premium.',
                    )}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    hapticImpactMedium();
                    onUpgradeTap?.();
                  }}
                  style={styles.upgradeBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.upgradeBtnText}>
                    {t('transform.unlockCta', 'UNLOCK FULL REPORT')}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#1E1B4B" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <View style={styles.statCard}>
      <MaterialIcons name={icon} size={20} color="#FDE047" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function InsightCard({ icon, title, body }) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIconBox}>
        <MaterialIcons name={icon} size={20} color="#FDE047" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightBody}>{body}</Text>
      </View>
    </View>
  );
}

const capitalize = (s) => {
  if (!s || typeof s !== 'string') return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  topLabel: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  scroll: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroEmoji: { fontSize: 64, marginBottom: 10 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
    paddingHorizontal: 24,
  },
  heroSub: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },

  // Top stats grid
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginVertical: 4,
    letterSpacing: -0.4,
  },
  statLabel: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.0,
    textAlign: 'center',
  },

  // Insight cards (premium)
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 12,
    marginTop: 10,
  },
  insightIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(253, 224, 71, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  insightBody: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Premium gate / lock
  premiumGate: {
    marginTop: 14,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  lockBlur: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  lockTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: -0.2,
  },
  lockSub: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FDE047',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  upgradeBtnText: {
    color: '#1E1B4B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.0,
  },

  // Share button (premium)
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FDE047',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  shareBtnText: {
    color: '#1E1B4B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
