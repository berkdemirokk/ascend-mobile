// AssessmentScreen — the 5-dimension self-assessment surface used
// both for the onboarding baseline AND every subsequent 30-day
// re-assessment. Modal-presented from Onboarding (mode='baseline')
// or from HomeScreen's "Yeniden Değerlendir" CTA (mode='post').
//
// UX choices that matter:
//   - All 5 questions on ONE scrolling screen, not 5 separate steps.
//     Multi-step surveys hemorrhage completers; single-screen forms
//     keep the cognitive frame of "this is a short thing".
//   - Sliders default to 5 (neutral). Asking "what's your discipline?"
//     with a slider starting at 0 reads as judgment.
//   - Single primary CTA. Skip is intentionally not offered for the
//     baseline — without a baseline there's no delta later, so the
//     whole report system collapses. For the post-assessment, Skip
//     exists (you can wait another day) but is visually demoted.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { LT } from '../config/lightTheme';
import { useApp } from '../contexts/AppContext';
import {
  ASSESSMENT_DIMENSIONS,
  ASSESSMENT_MAX_PER_DIM,
  defaultScores,
} from '../data/assessment';

export default function AssessmentScreen({ route, navigation }) {
  const { t } = useTranslation();
  // mode: 'baseline' (no callback wanted — onboarding handles it) or
  // 'post' (we write to AppContext via addAssessment + replace into
  // ProgressReport). The old design passed `onSubmit` via route.params
  // which React Navigation serialises — function refs got stripped
  // when the screen was restored from background, silently no-op'ing
  // the entire post-assessment save. Now we read addAssessment from
  // the context directly so there's no serialization layer.
  const { addAssessment, setBaselineAssessment } = useApp();
  const mode = route?.params?.mode || 'baseline';
  const [scores, setScores] = useState(defaultScores());
  // Track whether the user actually touched the sliders, so we can
  // distinguish a "tapped through with all-5 defaults" submit from
  // a real assessment. Defaults-only is still saved (so baseline isn't
  // lost), but Telemetry can later see how many users engaged for real.
  const [touchedAny, setTouchedAny] = useState(false);

  const setScore = (dimId, value) => {
    setScores((prev) => ({ ...prev, [dimId]: value }));
    if (!touchedAny) setTouchedAny(true);
  };

  const handleSubmit = () => {
    if (mode === 'post') {
      // Write through to AppContext + push the user into the report.
      // `navigation.replace` (not navigate) so back-button from the
      // report goes Home, not back into the now-stale assessment.
      try {
        addAssessment(scores);
      } catch {}
      try {
        navigation.replace('ProgressReport');
        return;
      } catch {
        navigation.goBack();
        return;
      }
    }
    // Baseline mode: the assessment was moved out of onboarding (D0
    // churn fix) and now runs right after the user finishes their
    // FIRST lesson — when the 'measure my starting point' framing
    // actually lands. Direct call to setBaselineAssessment writes the
    // canonical baseline; no need to call addAssessment.
    try {
      setBaselineAssessment(scores);
    } catch {}
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {mode === 'baseline'
              ? t('assessment.eyebrowBaseline', 'BAŞLANGIÇ DEĞERLENDİRMESİ')
              : t('assessment.eyebrowPost', '30 GÜN SONRA — TEKRAR ÖLÇ')}
          </Text>
          <Text style={styles.title}>
            {mode === 'baseline'
              ? t(
                  'assessment.titleBaseline',
                  'Şu an neredesin? Daha sonra bunu karşılaştıracağız.',
                )
              : t(
                  'assessment.titlePost',
                  'Bir ay önce şuradaydın. Bugün nerede olduğunu söyle.',
                )}
          </Text>
          <Text style={styles.help}>
            {t(
              'assessment.help',
              'Hızlı ol — 1 dakika. Cevaplara bakıp seni yargılamayacağız; sadece kendinle karşılaştırmak için kaydediyoruz.',
            )}
          </Text>
        </View>

        {/* Questions */}
        {ASSESSMENT_DIMENSIONS.map((dim, idx) => (
          <View key={dim.id} style={styles.questionCard}>
            <View style={styles.qHeader}>
              <View
                style={[
                  styles.qIcon,
                  { backgroundColor: `${dim.color}22`, borderColor: `${dim.color}55` },
                ]}
              >
                <MaterialIcons name={dim.icon} size={18} color={dim.color} />
              </View>
              <Text style={styles.qNumber}>{idx + 1}/5</Text>
              <Text style={styles.qLabel}>
                {t(dim.labelKey, dim.labelFallback)}
              </Text>
            </View>
            <Text style={styles.qText}>
              {t(dim.questionKey, dim.questionFallback)}
            </Text>

            {/* 10-point selector. Tapping a bubble sets the score —
                no native slider because RN sliders are platform-
                inconsistent and we want haptic discreteness anyway. */}
            <View style={styles.scaleRow}>
              {Array.from({ length: ASSESSMENT_MAX_PER_DIM }, (_, i) => i + 1).map(
                (v) => {
                  const isSelected = scores[dim.id] === v;
                  const isUnder = scores[dim.id] >= v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setScore(dim.id, v)}
                      style={[
                        styles.scaleDot,
                        isUnder && { backgroundColor: dim.color },
                        isSelected && styles.scaleDotSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scaleNum,
                          isUnder && { color: '#fff' },
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>
        ))}

        {/* Submit */}
        <TouchableOpacity
          style={styles.submit}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>
            {mode === 'baseline'
              ? t('assessment.submitBaseline', 'BAŞLANGICI KAYDET')
              : t('assessment.submitPost', 'KARŞILAŞTIRMAYI GÖR')}
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color={LT.onPrimary} />
        </TouchableOpacity>

        {mode === 'post' ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.skip}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.skipText}>
              {t('assessment.skipPost', 'Yarın yaparım')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  scroll: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 20 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: LT.onSurface,
    lineHeight: 28,
    marginBottom: 8,
  },
  help: {
    fontSize: 13,
    color: LT.onSurfaceVariant,
    lineHeight: 18,
  },
  questionCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  qIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  qNumber: {
    fontSize: 10,
    fontWeight: '900',
    color: LT.onSurfaceVariant,
    letterSpacing: 0.8,
  },
  qLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.onSurface,
    flex: 1,
  },
  qText: {
    fontSize: 14,
    color: LT.onSurface,
    lineHeight: 20,
    marginBottom: 12,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  scaleDot: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotSelected: {
    borderColor: LT.onSurface,
    borderWidth: 2,
  },
  scaleNum: {
    fontSize: 11,
    fontWeight: '800',
    color: LT.onSurfaceVariant,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  submitText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
  skip: {
    alignSelf: 'center',
    padding: 12,
    marginTop: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
});
