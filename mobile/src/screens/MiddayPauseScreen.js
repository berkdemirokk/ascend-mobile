// MiddayPauseScreen — the 13:00 60-second stoic break that 2x's session count.
//
// Three sequential blocks the user moves through:
//   A. Quote (15s passive read) — today's daily quote, large italics, fade-in
//   B. Breath (30s, 4-7-8 pattern × 1.5 cycles) — animated circle, haptic
//      pulses on phase change. A small "skip" link lets people out so the
//      modal never feels like a trap.
//   C. Mood + commit (15s) — 3 emoji buttons. Tap → +5 XP grant + closing
//      message "Akşam 20:30'da seni bekliyoruz." → auto-close in 2 sec OR
//      user can tap "Devam" to leave immediately.
//
// Modal presentation, no nav header. Always lets the user back out via the
// system gesture (modal swipe-down) at any moment.
//
// State side-effect: on completion, completeMiddayPause() stamps today's
// date into middayPauseCompletedAt and grantBonusXP(5) tops up XP. Both
// are idempotent — re-entering the screen the same day is harmless.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '../contexts/AppContext';
import { getDailyQuote } from '../config/quotes';
import { getCurrentLanguage } from '../i18n';
import { hapticImpactLight, hapticSuccess } from '../services/haptics';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

// Today's date key — matches the format used by AppContext / cloudSync.
const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 4-7-8 breath. 1.5 cycles = 28.5s (inhale4 + hold7 + exhale8 + inhale4 +
// hold4-truncated). Total fits the 30-second budget for Block B.
const BREATH_PHASES = [
  { id: 'inhale', seconds: 4, labelKey: 'midday.middayBreathInhale' },
  { id: 'hold',   seconds: 7, labelKey: 'midday.middayBreathHold' },
  { id: 'exhale', seconds: 8, labelKey: 'midday.middayBreathExhale' },
  { id: 'inhale', seconds: 4, labelKey: 'midday.middayBreathInhale' },
  { id: 'hold',   seconds: 4, labelKey: 'midday.middayBreathHold' },
  // Truncated final hold so we don't overrun 30 seconds. The user has
  // already done a full 4-7-8 cycle + a fresh 4-inhale + a brief 4-hold,
  // which feels complete without dragging.
];

const MOOD_OPTIONS = [
  { id: 'high',  emoji: '🔥',     labelKey: 'midday.middayMoodHigh' },
  { id: 'mid',   emoji: '😐',     labelKey: 'midday.middayMoodMid' },
  { id: 'tired', emoji: '😮‍💨', labelKey: 'midday.middayMoodTired' },
];

export default function MiddayPauseScreen({ navigation }) {
  const { t } = useTranslation();
  const { completeMiddayPause, grantBonusXP, middayPauseCompletedAt } = useApp();
  // Snapshot the "already done today" state on mount — if the user
  // returns to the screen later in the same day we skip the XP grant
  // (completeMiddayPause is idempotent on its own, but grantBonusXP
  // is not — it would keep stacking XP).
  const alreadyDoneTodayRef = useRef(middayPauseCompletedAt === getTodayKey());

  // The daily quote — same for every device on the same calendar day.
  // Memoized so it's stable across re-renders within the session even if
  // the user keeps the screen open across local midnight (edge case).
  const quote = useMemo(() => getDailyQuote(), []);
  const lang = getCurrentLanguage();
  const quoteText = lang === 'en' ? quote.en : quote.tr;

  // Block visibility — we keep all three rendered in a vertical scroll so
  // power-users can fast-forward. The mood block stays interactive even
  // while the breath is mid-cycle; users can tap it whenever they want.
  // ─── Quote fade-in ───────────────────────────────────────────────────
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(quoteOpacity, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [quoteOpacity]);

  // ─── Breath state ────────────────────────────────────────────────────
  const [breathStarted, setBreathStarted] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [breathDone, setBreathDone] = useState(false);
  const circleScale = useRef(new Animated.Value(0.55)).current;
  const lastHoldScaleRef = useRef(1.0); // remember scale at end of last inhale
  const phaseTimerRef = useRef(null);

  // Phase advance + circle animation. inhale = expand, hold = stay,
  // exhale = contract. The scale curve is intentionally smooth (cubic)
  // so the visual feels like breathing, not a robotic step.
  useEffect(() => {
    if (!breathStarted) return;
    if (phaseIndex >= BREATH_PHASES.length) {
      setBreathDone(true);
      hapticSuccess();
      return;
    }

    const phase = BREATH_PHASES[phaseIndex];
    // Phase-change haptic. Light pulse — never overwhelming.
    hapticImpactLight();

    // Animate the circle for this phase. We track the most recent
    // post-inhale scale in lastHoldScaleRef so the "hold" phase stays
    // pinned at the expanded size instead of trying to introspect the
    // Animated.Value (which doesn't expose a public getter).
    let toScale = 0.55;
    if (phase.id === 'inhale') {
      toScale = 1.0;
      lastHoldScaleRef.current = 1.0;
    } else if (phase.id === 'hold') {
      toScale = lastHoldScaleRef.current;
    } else if (phase.id === 'exhale') {
      toScale = 0.55;
      lastHoldScaleRef.current = 0.55;
    }

    Animated.timing(circleScale, {
      toValue: toScale,
      duration: phase.seconds * 1000,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    phaseTimerRef.current = setTimeout(() => {
      setPhaseIndex((i) => i + 1);
    }, phase.seconds * 1000);

    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    };
  }, [phaseIndex, breathStarted, circleScale]);

  const currentPhase =
    breathStarted && phaseIndex < BREATH_PHASES.length
      ? BREATH_PHASES[phaseIndex]
      : null;

  const breathLabel = currentPhase
    ? `${t(currentPhase.labelKey)} · ${currentPhase.seconds}`
    : breathDone
      ? t('midday.middayBreathDone', '✓')
      : t('midday.middayBreathStart', 'Başlat');

  // ─── Mood + close ────────────────────────────────────────────────────
  const [pickedMood, setPickedMood] = useState(null);
  const [closing, setClosing] = useState(false);
  const autoCloseTimerRef = useRef(null);

  const handleMoodPick = (moodId) => {
    if (pickedMood) return; // single-shot
    setPickedMood(moodId);
    hapticSuccess();
    // Mark today as done. completeMiddayPause is idempotent per day,
    // so re-entering the screen later won't double-stamp it. The XP
    // grant is NOT idempotent (grantBonusXP keeps adding), so we gate
    // it on the snapshot taken at mount.
    try { completeMiddayPause(); } catch {}
    if (!alreadyDoneTodayRef.current) {
      try { grantBonusXP(5, 'middayPause'); } catch {}
    }
    setClosing(true);
    // Auto-close after 2s — gives the user a beat to read the closing
    // line. They can tap "Devam" to leave instantly.
    autoCloseTimerRef.current = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, 2000);
  };

  const handleContinue = () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleSkip = () => {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (navigation.canGoBack()) navigation.goBack();
  };

  // Cleanup any lingering timers if user dismisses via gesture.
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header pill */}
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>
            {t('midday.middayLabel', 'ÖĞLE MOLASI')}
          </Text>
        </View>
        <Text style={styles.headerHook}>
          {t('midday.middayHook', '60 saniye. Sustur. Otur.')}
        </Text>

        {/* ── Block A: Quote ─────────────────────────────────────────── */}
        <Animated.View style={[styles.quoteBlock, { opacity: quoteOpacity }]}>
          <Text style={styles.quoteText}>"{quoteText}"</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
        </Animated.View>

        {/* ── Block B: Breath ────────────────────────────────────────── */}
        <View style={styles.breathBlock}>
          <View style={styles.circleWrap}>
            <Animated.View
              style={[
                styles.breathCircle,
                { transform: [{ scale: circleScale }] },
              ]}
            />
          </View>
          <Text style={styles.breathLabel}>{breathLabel}</Text>

          {!breathStarted ? (
            <TouchableOpacity
              style={styles.breathStartBtn}
              onPress={() => {
                setBreathStarted(true);
                hapticImpactLight();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.breathStartBtnText}>
                {t('midday.middayBreathStart', 'BAŞLAT')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Block C: Mood + commit ─────────────────────────────────── */}
        <View style={styles.moodBlock}>
          <Text style={styles.moodPrompt}>
            {t('midday.middayMoodPrompt', 'Şu an nasılsın?')}
          </Text>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((opt) => {
              const isPicked = pickedMood === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.moodBtn,
                    isPicked && styles.moodBtnPicked,
                    pickedMood && !isPicked && styles.moodBtnDimmed,
                  ]}
                  onPress={() => handleMoodPick(opt.id)}
                  activeOpacity={0.8}
                  disabled={!!pickedMood}
                >
                  <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {closing ? (
            <View style={styles.closingBlock}>
              <Text style={styles.closingLine}>
                {t(
                  'midday.middayCloseLine',
                  'Akşam 20:30\'da seni bekliyoruz.',
                )}
              </Text>
              <Text style={styles.closingXp}>+5 XP</Text>
              <TouchableOpacity
                style={styles.continueBtn}
                onPress={handleContinue}
                activeOpacity={0.85}
              >
                <Text style={styles.continueBtnText}>
                  {t('midday.middayContinue', 'Devam')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={{ height: 56 }} />
      </ScrollView>

      {/* Hairline skip — bottom right. Always available so the modal
          never feels coercive. */}
      {!closing ? (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>
            {t('midday.middaySkip', 'Geç')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LT.background,
  },
  scrollContent: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },

  headerPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.primaryContainer,
    marginBottom: 10,
  },
  headerPillText: {
    color: LT.onPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerHook: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: LT.onSurfaceVariant,
    marginBottom: 28,
    textAlign: 'center',
  },

  // ── Block A ─────────────────────────────────────────────────────────
  quoteBlock: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 28,
  },
  quoteText: {
    fontSize: 22,
    lineHeight: 32,
    fontStyle: 'italic',
    fontWeight: '500',
    color: LT.onSurface,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  quoteAuthor: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
    textTransform: 'uppercase',
  },

  // ── Block B ─────────────────────────────────────────────────────────
  breathBlock: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 28,
  },
  circleWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  breathCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: LT.primaryContainer,
    opacity: 0.85,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  breathLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: LT.onSurface,
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  breathStartBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.onSurface,
  },
  breathStartBtnText: {
    color: LT.onPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },

  // ── Block C ─────────────────────────────────────────────────────────
  moodBlock: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 18,
  },
  moodPrompt: {
    fontSize: 16,
    fontWeight: '700',
    color: LT.onSurface,
    letterSpacing: -0.2,
    marginBottom: 18,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  moodBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodBtnPicked: {
    borderColor: LT.primaryContainer,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    transform: [{ scale: 1.06 }],
  },
  moodBtnDimmed: {
    opacity: 0.4,
  },
  moodEmoji: {
    fontSize: 30,
  },

  closingBlock: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 6,
  },
  closingLine: {
    fontSize: 14,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  closingXp: {
    fontSize: 22,
    fontWeight: '900',
    color: LT.primaryContainer,
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  continueBtn: {
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.primaryContainer,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  continueBtnText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
  },

  // Skip — bottom-right hairline.
  skipBtn: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: LT.outline,
    letterSpacing: 0.4,
  },
});
