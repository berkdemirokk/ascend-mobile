// ProgressReportScreen — pre/post assessment delta surface. The
// payoff for the whole Outcome Assessment system: the user sees
// concrete proof that they CHANGED. Not "you opened the app 30
// times" (irrelevant), but "Disiplin: 5 → 8 · +3 puan" (real).
//
// Shown right after the user completes a post-assessment via the
// AssessmentScreen onSubmit callback (HomeScreen route). For
// baseline-only users who don't have a post yet, this screen
// shouldn't be reachable.

import React, { useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { LT } from '../config/lightTheme';
import ConfettiBurst from '../components/ConfettiBurst';
import { useApp } from '../contexts/AppContext';
import {
  ASSESSMENT_DIMENSIONS,
  ASSESSMENT_TOTAL_MAX,
  totalScore,
  computeDelta,
} from '../data/assessment';

export default function ProgressReportScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    baselineAssessment,
    latestAssessment,
    userProfile,
    // Objective metrics for the new ÖLÇÜLEBİLİR İLERLEME block.
    // Self-report delta alone is subjective + placebo-prone; surfacing
    // hard counts (lessons completed since baseline, current streak,
    // reflections written) gives the user — and the share image — a
    // measurable backbone the slider scores can't fake.
    pathProgress,
    currentStreak,
    longestStreak,
    totalLessonsCompleted,
    lessonHistory,
    dailyDeckHistory,
  } = useApp();

  // Defensive: if either side is missing, bail to Home. Reachable
  // only if a buggy callsite navigates here prematurely.
  if (!baselineAssessment?.scores || !latestAssessment?.scores) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.placeholderText}>
            {t(
              'progressReport.notReady',
              'Henüz karşılaştıracak veri yok. 30 gün dolduğunda gelirsin.',
            )}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backLink}>
              {t('common.back', 'Geri')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const delta = computeDelta(
    baselineAssessment.scores,
    latestAssessment.scores,
  );
  const beforeTotal = totalScore(baselineAssessment.scores);
  const afterTotal = totalScore(latestAssessment.scores);

  // ── Objective metrics since baseline ─────────────────────────────
  // Count lessons completed AFTER the baseline timestamp. We can't
  // know per-lesson timestamps (pathProgress.completed is an array of
  // lessonIds with no times), so we use lessonHistory which IS date-
  // keyed — sum the counts for every date >= baseline date. Same
  // approach for reflections and deck completions.
  const baselineDate = new Date(baselineAssessment.ts || 0)
    .toISOString()
    .slice(0, 10);
  const lessonsSinceBaseline = Object.entries(lessonHistory || {})
    .filter(([date]) => date >= baselineDate)
    .reduce((sum, [, n]) => sum + (n || 0), 0);
  const reflectionsCount = (() => {
    let n = 0;
    for (const p of Object.values(pathProgress || {})) {
      n += Object.keys(p?.reflections || {}).length;
    }
    return n;
  })();
  const deckCompletionsSinceBaseline = (dailyDeckHistory || []).filter(
    (e) => (e?.date || '') >= baselineDate,
  ).length;
  // Days elapsed (clamped at 30 for the typical first cycle).
  const daysElapsed = Math.max(
    1,
    Math.floor(
      (Date.now() - (baselineAssessment.ts || 0)) / (24 * 60 * 60 * 1000),
    ),
  );

  // Fire the celebration haptic on mount for positive deltas only.
  // Mirrors the visual confetti gate in the hero block.
  useEffect(() => {
    if (delta.totalDelta > 0) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = async () => {
    try {
      // Share message now leads with the OBJECTIVE metric (lessons
      // completed), then the self-report delta, then a CTA. Removes
      // the 'before score' that audit flagged as embarrassment.
      const msg = t(
        'progressReport.shareMsg',
        '{{days}} günde {{lessons}} ders, {{streak}} günlük seri. Kendime göre +{{delta}} puan ilerleme. Ascend: Monk Mode ile takip ediyorum.',
        {
          days: daysElapsed,
          lessons: lessonsSinceBaseline,
          streak: currentStreak || 0,
          delta:
            delta.totalDelta >= 0 ? delta.totalDelta : delta.totalDelta,
        },
      );
      await Share.share({ message: msg });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — the headline number. Positive delta fires a success
            haptic + confetti burst on mount, turning the moment into
            a celebration. Zero or negative deltas get no fanfare —
            the user's not in a celebration mood and confetti there
            would feel tone-deaf. */}
        <View style={styles.hero}>
          {delta.totalDelta > 0 ? (
            <ConfettiBurst trigger={delta.totalDelta} />
          ) : null}
          <Text style={styles.heroEyebrow}>
            {t('progressReport.eyebrow', '30 GÜN SONRA')}
          </Text>
          <Text style={styles.heroDelta}>
            {delta.totalDelta >= 0
              ? `+${delta.totalDelta}`
              : `${delta.totalDelta}`}
          </Text>
          <Text style={styles.heroDeltaUnit}>
            {t('progressReport.points', 'PUAN')}
          </Text>
          <Text style={styles.heroBeforeAfter}>
            {beforeTotal} → {afterTotal} / {ASSESSMENT_TOTAL_MAX}
          </Text>
        </View>

        {/* ÖLÇÜLEBİLİR İLERLEME — objective backbone for the
            subjective self-report above. These numbers can't be
            "felt up" by a placebo bias: lessons completed, current
            streak, longest streak, reflections written, decks done.
            Audit finding: 'self-report likert without an objective
            anchor is just mood, not measurement'. Fixes that. */}
        <View style={styles.objectiveBlock}>
          <Text style={styles.objectiveHeader}>
            {t('progressReport.objectiveLabel', 'ÖLÇÜLEBİLİR İLERLEME')}
          </Text>
          <View style={styles.objectiveGrid}>
            <View style={styles.objectiveCell}>
              <Text style={styles.objectiveValue}>{lessonsSinceBaseline}</Text>
              <Text style={styles.objectiveLabel}>
                {t('progressReport.lessonsLabel', 'DERS')}
              </Text>
            </View>
            <View style={styles.objectiveDivider} />
            <View style={styles.objectiveCell}>
              <Text style={styles.objectiveValue}>{currentStreak || 0}</Text>
              <Text style={styles.objectiveLabel}>
                {t('progressReport.streakLabel', 'GÜN SERİ')}
              </Text>
            </View>
            <View style={styles.objectiveDivider} />
            <View style={styles.objectiveCell}>
              <Text style={styles.objectiveValue}>{reflectionsCount}</Text>
              <Text style={styles.objectiveLabel}>
                {t('progressReport.reflectionsLabel', 'YANSIMA')}
              </Text>
            </View>
            <View style={styles.objectiveDivider} />
            <View style={styles.objectiveCell}>
              <Text style={styles.objectiveValue}>
                {deckCompletionsSinceBaseline}
              </Text>
              <Text style={styles.objectiveLabel}>
                {t('progressReport.decksLabel', 'DESTE')}
              </Text>
            </View>
          </View>
          <Text style={styles.objectiveFooter}>
            {t(
              'progressReport.objectiveFooter',
              '{{days}} günde — sayılar yalan söylemez.',
              { days: daysElapsed },
            )}
          </Text>
        </View>

        {/* Per-dimension breakdown (subjective self-report) */}
        <View style={styles.dimList}>
          {delta.dimensions.map((d) => {
            const meta = ASSESSMENT_DIMENSIONS.find((x) => x.id === d.id);
            const positive = d.delta > 0;
            const neutral = d.delta === 0;
            return (
              <View key={d.id} style={styles.dimRow}>
                <View
                  style={[
                    styles.dimIconBox,
                    { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}55` },
                  ]}
                >
                  <MaterialIcons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dimLabel}>
                    {t(meta.labelKey, meta.labelFallback)}
                  </Text>
                  <Text style={styles.dimNums}>
                    {d.before} → {d.after}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.dimDelta,
                    positive && { color: '#10B981' },
                    neutral && { color: LT.onSurfaceVariant },
                    d.delta < 0 && { color: LT.primary },
                  ]}
                >
                  {d.delta > 0 ? `+${d.delta}` : `${d.delta}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Narrative */}
        <View style={styles.narrative}>
          {delta.totalDelta >= 10 ? (
            <Text style={styles.narrativeText}>
              {t(
                'progressReport.narrativeBig',
                '{{delta}} puanlık bir sıçrama 30 günde sıradan değil. Yüksek artış olduğun alanı koru; düşük olanı önümüzdeki 30 gün hedefin yap.',
                { delta: delta.totalDelta },
              )}
            </Text>
          ) : delta.totalDelta > 0 ? (
            <Text style={styles.narrativeText}>
              {t(
                'progressReport.narrativeSmall',
                'Pozitif yöndesin. Küçük ilerleme — sabit pratikle 90 günde fark katlanır.',
              )}
            </Text>
          ) : delta.totalDelta === 0 ? (
            <Text style={styles.narrativeText}>
              {t(
                'progressReport.narrativeFlat',
                'Aynı yerdesin. Sabit kalmak da bir başarı, ama önümüzdeki 30 gün için tek alana odaklan — orada artışı zorla.',
              )}
            </Text>
          ) : (
            <Text style={styles.narrativeText}>
              {t(
                'progressReport.narrativeDown',
                'Düştün — kötü değil, dürüst. Çoğu insan kendine yalan söyler. Hangi alanda en çok düştüğünü gör, oradan yeniden başla.',
              )}
            </Text>
          )}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <MaterialIcons name="ios-share" size={18} color={LT.onPrimary} />
          <Text style={styles.shareBtnText}>
            {t('progressReport.share', 'PAYLAŞ')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.dismiss}
        >
          <Text style={styles.dismissText}>
            {t('progressReport.dismiss', 'Tamam')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  scroll: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  placeholderText: {
    fontSize: 14,
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 16,
  },
  backLink: {
    fontSize: 13,
    fontWeight: '800',
    color: LT.primary,
  },

  // Hero block
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.primary,
    marginBottom: 8,
  },
  heroDelta: {
    fontSize: 72,
    fontWeight: '900',
    color: LT.onSurface,
    lineHeight: 78,
    letterSpacing: -2,
  },
  heroDeltaUnit: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
    marginTop: -4,
  },
  heroBeforeAfter: {
    fontSize: 14,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    marginTop: 12,
  },

  // Per-dimension
  // ÖLÇÜLEBİLİR İLERLEME block — four equal cells with hard counts.
  // Visually higher contrast than the per-dimension list below it so
  // the user's eye lands on objective numbers first.
  objectiveBlock: {
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  objectiveHeader: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.primary,
    marginBottom: 12,
  },
  objectiveGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
  },
  objectiveCell: {
    flex: 1,
    alignItems: 'center',
  },
  objectiveDivider: {
    width: 1,
    backgroundColor: LT.outlineVariant,
    marginVertical: 4,
  },
  objectiveValue: {
    fontSize: 22,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 2,
  },
  objectiveLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: LT.onSurfaceVariant,
  },
  objectiveFooter: {
    fontSize: 11,
    fontStyle: 'italic',
    color: LT.onSurfaceVariant,
    textAlign: 'center',
  },
  dimList: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    overflow: 'hidden',
    marginBottom: 16,
  },
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  dimIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dimLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 2,
  },
  dimNums: {
    fontSize: 11,
    color: LT.onSurfaceVariant,
    fontWeight: '600',
  },
  dimDelta: {
    fontSize: 20,
    fontWeight: '900',
    minWidth: 44,
    textAlign: 'right',
  },

  // Narrative
  narrative: {
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  narrativeText: {
    fontSize: 14,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 20,
  },

  // CTAs
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
  dismiss: {
    alignSelf: 'center',
    padding: 14,
    marginTop: 4,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
});
