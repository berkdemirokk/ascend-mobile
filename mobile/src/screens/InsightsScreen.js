// InsightsScreen — "Stats" tab in the redesigned 4-tab nav.
// Vivid Impact light theme. Shows quiz accuracy, path progress, records,
// premium upsell.
//
// File name kept as InsightsScreen.js to avoid touching navigation imports.
// Tab label is "Stats" (set in AppNavigator).
//
// Backup: InsightsScreen.legacy.js

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '../contexts/AppContext';
import { PATHS } from '../data/paths';
import LightTopAppBar from '../components/LightTopAppBar';
import StreakInfoModal from '../components/StreakInfoModal';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

export default function InsightsScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    pathProgress,
    totalXP,
    currentStreak,
    longestStreak,
    level,
    isPremium,
    lessonHistory,
  } = useApp();
  const [streakInfoVisible, setStreakInfoVisible] = useState(false);

  const stats = useMemo(() => {
    let totalLessons = 0;
    let totalQuizCorrect = 0;
    let totalQuizQuestions = 0;
    const pathStats = [];

    for (const path of PATHS) {
      const prog = pathProgress?.[path.id];
      const completed = prog?.completed?.length || 0;
      const quizCorrect = prog?.quizCorrect || {};
      const correctSum = Object.values(quizCorrect).reduce(
        (s, n) => s + (n || 0),
        0,
      );
      const questionsTotal = completed * 2;
      totalLessons += completed;
      totalQuizCorrect += correctSum;
      totalQuizQuestions += questionsTotal;
      pathStats.push({
        path,
        completed,
        total: path.duration,
        percent: Math.round((completed / path.duration) * 100),
        correctRate:
          questionsTotal > 0
            ? Math.round((correctSum / questionsTotal) * 100)
            : 0,
      });
    }

    const accuracy =
      totalQuizQuestions > 0
        ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100)
        : 0;

    return {
      totalLessons,
      totalQuizCorrect,
      totalQuizQuestions,
      accuracy,
      pathStats,
    };
  }, [pathProgress]);

  // Last 7 days, oldest first. Includes today.
  const weekStats = useMemo(() => {
    const days = [];
    let totalLessons = 0;
    let activeDays = 0;
    let bestCount = 0;
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const count = (lessonHistory || {})[key] || 0;
      if (count > 0) activeDays += 1;
      if (count > bestCount) bestCount = count;
      totalLessons += count;
      days.push({ key, count, dayNum: d.getDate(), isToday: i === 0 });
    }
    return { days, totalLessons, activeDays, bestCount };
  }, [lessonHistory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />

      <LightTopAppBar
        onAvatarPress={() => navigation.navigate('Settings')}
        onStreakPress={() => setStreakInfoVisible(true)}
        currentStreak={currentStreak}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>
            {t('insights.title', 'İstatistikler')}
          </Text>
          <Text style={styles.pageSubtitle}>
            {t(
              'insights.subtitle',
              'Yolculuğun, sayılarda. Disiplinin somut ifadesi.',
            )}
          </Text>
        </View>

        {/* Weekly Recap — last 7 days */}
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <View>
              <Text style={styles.weekLabel}>
                {t('insights.weekLabel', 'BU HAFTA')}
              </Text>
              <Text style={styles.weekTotal}>
                {weekStats.totalLessons}{' '}
                <Text style={styles.weekTotalUnit}>
                  {t('insights.weekLessons', 'ders')}
                </Text>
              </Text>
            </View>
            <View style={styles.weekActiveBadge}>
              <MaterialIcons
                name="event-available"
                size={14}
                color={LT.primaryContainer}
              />
              <Text style={styles.weekActiveText}>
                {t('insights.weekActiveDays', '{{count}}/7 gün aktif', {
                  count: weekStats.activeDays,
                })}
              </Text>
            </View>
          </View>

          <View style={styles.weekBars}>
            {weekStats.days.map((d, idx) => {
              const ratio =
                weekStats.bestCount > 0
                  ? Math.max(0.08, d.count / weekStats.bestCount)
                  : 0.08;
              return (
                <View key={d.key} style={styles.weekBarColumn}>
                  <View style={styles.weekBarTrack}>
                    <View
                      style={[
                        styles.weekBarFill,
                        {
                          height: `${ratio * 100}%`,
                          backgroundColor:
                            d.count > 0
                              ? LT.primaryContainer
                              : LT.outlineVariant,
                        },
                        d.isToday && styles.weekBarFillToday,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.weekBarLabel,
                      d.isToday && styles.weekBarLabelToday,
                    ]}
                  >
                    {d.dayNum}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Big number hero — Quiz accuracy */}
        <View style={styles.bigHero}>
          <View style={styles.bigHeroText}>
            <Text style={styles.bigHeroLabel}>
              {t('insights.heroLabel', 'QUIZ DOĞRULUK')}
            </Text>
            <View style={styles.bigHeroNumberRow}>
              <Text style={styles.bigHeroNumber}>{stats.accuracy}</Text>
              <Text style={styles.bigHeroPercent}>%</Text>
            </View>
            <Text style={styles.bigHeroSub}>
              {stats.totalQuizCorrect} / {stats.totalQuizQuestions}{' '}
              {t('insights.correct', 'doğru')}
            </Text>
          </View>
          <View style={styles.bigHeroVerdict}>
            <MaterialIcons
              name={stats.accuracy >= 60 ? 'trending-up' : 'tips-and-updates'}
              size={24}
              color={
                stats.accuracy >= 60 ? LT.primaryContainer : LT.onSurfaceVariant
              }
            />
            <Text style={styles.bigHeroVerdictText}>
              {stats.accuracy >= 80
                ? t('insights.accuracyGreat', 'Mükemmel')
                : stats.accuracy >= 60
                  ? t('insights.accuracyGood', 'İyi')
                  : stats.accuracy >= 30
                    ? t('insights.accuracyOk', 'Geliştir')
                    : t('insights.accuracyNew', 'Başla')}
            </Text>
          </View>
        </View>

        {/* Quick stat row */}
        <View style={styles.statRow}>
          <QuickStat
            icon="bolt"
            label={t('insights.statXp', 'TOPLAM XP')}
            value={(totalXP ?? 0).toLocaleString('en-US')}
          />
          <View style={styles.rowDivider} />
          <QuickStat
            icon="local-fire-department"
            iconColor={LT.primaryContainer}
            label={t('insights.statStreak', 'SERİ')}
            value={`${currentStreak}`}
          />
          <View style={styles.rowDivider} />
          <QuickStat
            icon="emoji-events"
            label={t('insights.statLevel', 'SEVİYE')}
            value={`${level}`}
          />
        </View>

        {/* Path Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('insights.pathProgress', 'YOL İLERLEMESİ')}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {stats.totalLessons}{' '}
            {t('insights.lessonsTotal', 'toplam ders tamamlandı')}
          </Text>
          <View style={styles.pathList}>
            {stats.pathStats.map((s) => (
              <PathProgressRow key={s.path.id} stat={s} t={t} />
            ))}
          </View>
        </View>

        {/* Records */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('insights.records', 'REKORLAR')}
          </Text>
          <View style={styles.recordList}>
            <RecordRow
              icon="local-fire-department"
              label={t('insights.longestStreak', 'En uzun seri')}
              value={`${longestStreak || 0}`}
              unit={t('common.days', 'gün')}
              accent
            />
            <RecordRow
              icon="menu-book"
              label={t('insights.lessonsTotal', 'Toplam ders')}
              value={`${stats.totalLessons}`}
              unit={t('common.lessons', 'ders')}
            />
            <RecordRow
              icon="quiz"
              label={t('insights.quizCorrect', 'Quiz doğru')}
              value={`${stats.totalQuizCorrect}`}
              unit={t('insights.questions', 'soru')}
            />
          </View>
        </View>

        {/* Premium upsell */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.upsell}
            onPress={() => navigation.navigate('Paywall')}
            activeOpacity={0.9}
          >
            <View style={styles.upsellInner}>
              <Text style={styles.upsellLabel}>
                {t('insights.upsellLabel', 'PREMIUM')}
              </Text>
              <Text style={styles.upsellTitle}>
                {t('insights.upsellTitle', 'Daha derin istatistikler')}
              </Text>
              <Text style={styles.upsellBody}>
                {t(
                  'insights.upsellBody',
                  'Haftalık trendler, en iyi performans saatleri, başarı korelasyonları.',
                )}
              </Text>
              <View style={styles.upsellCta}>
                <Text style={styles.upsellCtaText}>
                  {t('insights.upsellCta', 'PREMIUM\'A GEÇ')}
                </Text>
                <MaterialIcons
                  name="arrow-forward"
                  size={16}
                  color={LT.onPrimary}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <StreakInfoModal
        visible={streakInfoVisible}
        onClose={() => setStreakInfoVisible(false)}
        currentStreak={currentStreak}
      />
    </SafeAreaView>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function QuickStat({ icon, iconColor, label, value }) {
  return (
    <View style={styles.quickStat}>
      <MaterialIcons name={icon} size={18} color={iconColor || LT.onSurfaceVariant} />
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

function PathProgressRow({ stat, t }) {
  const { path, completed, total, percent } = stat;
  return (
    <View style={styles.pathRow}>
      <View style={styles.pathRowHeader}>
        <View style={styles.pathRowIconWrap}>
          <MaterialIcons
            name={path.materialIcon}
            size={16}
            color={LT.onSurfaceVariant}
          />
        </View>
        <Text style={styles.pathRowTitle} numberOfLines={1}>
          {t(`paths.${path.id}.shortTitle`, path.id)}
        </Text>
        <Text style={styles.pathRowCount}>
          {completed}/{total}
        </Text>
      </View>
      <View style={styles.pathRowTrack}>
        <View
          style={[
            styles.pathRowFill,
            {
              width: `${Math.max(percent, 2)}%`,
              backgroundColor:
                percent === 0 ? LT.outlineVariant : LT.primaryContainer,
            },
          ]}
        />
      </View>
    </View>
  );
}

function RecordRow({ icon, label, value, unit, accent }) {
  return (
    <View style={styles.recordRow}>
      <View
        style={[styles.recordIcon, accent && styles.recordIconAccent]}
      >
        <MaterialIcons
          name={icon}
          size={18}
          color={accent ? LT.primaryContainer : LT.onSurfaceVariant}
        />
      </View>
      <Text style={styles.recordLabel}>{label}</Text>
      <View style={styles.recordValueWrap}>
        <Text
          style={[styles.recordValue, accent && styles.recordValueAccent]}
        >
          {value}
        </Text>
        <Text style={styles.recordUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LT.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Page header
  pageHeader: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 28,
    paddingBottom: 18,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 38,
    color: LT.onSurface,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: LT.onSurfaceVariant,
  },

  // Weekly recap
  weekCard: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
    marginBottom: 4,
  },
  weekTotal: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    color: LT.onSurface,
    lineHeight: 38,
  },
  weekTotalUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
    letterSpacing: 0,
  },
  weekActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  weekActiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: LT.onSurface,
  },
  weekBars: {
    flexDirection: 'row',
    height: 96,
    alignItems: 'flex-end',
    gap: 6,
  },
  weekBarColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  weekBarTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: LT.surfaceContainer,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  weekBarFill: {
    width: '100%',
    borderRadius: 6,
  },
  weekBarFillToday: {
    borderWidth: 1.5,
    borderColor: LT.primary,
  },
  weekBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
  },
  weekBarLabelToday: {
    color: LT.primary,
    fontWeight: '900',
  },

  // Big hero (quiz accuracy)
  bigHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 20,
  },
  bigHeroText: {
    flex: 1,
  },
  bigHeroLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
    marginBottom: 6,
  },
  bigHeroNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bigHeroNumber: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2.5,
    color: LT.primaryContainer,
    lineHeight: 64,
  },
  bigHeroPercent: {
    fontSize: 32,
    fontWeight: '900',
    color: LT.primaryContainer,
    letterSpacing: -1,
    marginBottom: 8,
  },
  bigHeroSub: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: LT.onSurfaceVariant,
    marginTop: 4,
  },
  bigHeroVerdict: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  bigHeroVerdictText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    color: LT.onSurface,
    textTransform: 'uppercase',
  },

  // Quick stat row
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 14,
  },
  rowDivider: {
    width: 1,
    backgroundColor: LT.outlineVariant,
    marginVertical: 8,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: LT.onSurface,
    letterSpacing: -0.4,
  },
  quickStatLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
  },

  // Sections
  section: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurface,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    marginBottom: 14,
  },

  // Path list
  pathList: {
    gap: 12,
  },
  pathRow: {
    gap: 6,
  },
  pathRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pathRowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathRowTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: LT.onSurface,
  },
  pathRowCount: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.2,
    color: LT.onSurfaceVariant,
    minWidth: 50,
    textAlign: 'right',
  },
  pathRowTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: LT.surfaceContainer,
    overflow: 'hidden',
    marginLeft: 36, // align under text (skip the 28pt icon + 8pt gap)
    width: 'auto',
  },
  pathRowFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Records list
  recordList: {
    gap: 0,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIconAccent: {
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderColor: 'rgba(227, 18, 18, 0.18)',
  },
  recordLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: LT.onSurface,
  },
  recordValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  recordValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: LT.onSurface,
  },
  recordValueAccent: {
    color: LT.primaryContainer,
  },
  recordUnit: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: LT.outline,
    textTransform: 'uppercase',
  },

  // Leaderboard CTA
  leaderboardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 16,
  },
  leaderboardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.18)',
  },
  leaderboardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 2,
  },
  leaderboardSub: {
    fontSize: 11,
    color: LT.onSurfaceVariant,
    fontWeight: '600',
  },

  // Premium upsell
  upsell: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
  },
  upsellInner: {
    backgroundColor: LT.primaryContainer,
    borderRadius: LT_RADIUS.xl,
    padding: 22,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  upsellLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  upsellTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: LT.onPrimary,
    lineHeight: 28,
    marginBottom: 6,
  },
  upsellBody: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 18,
  },
  upsellCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    height: 44,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  upsellCtaText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
});
