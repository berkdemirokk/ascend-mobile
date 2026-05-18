// EveningCloseScreen — the 20:30 "Günü Kapat" stoic ritual that closes
// the daily ritual cycle (morning lesson → midday breath → evening close).
//
// Three sequential blocks, ~3-4 minutes total:
//   A. "Bugün ne öğrendin?" (~90s) — multiline TextInput, max 280 chars.
//      User types one line about today. Saves into the
//      eveningReflections: { 'YYYY-MM-DD': text } map.
//   B. "Yarın için tek niyet" (~60s) — 3-card picker (Disiplin / Odak /
//      Sakinlik). User picks one. Saves tomorrowIntent so the morning
//      greeting subtitle reads "Bugün için niyetin: …" — pre-seeds
//      the next morning open and closes the cycle.
//   C. Curiosity gap (~15s) — shows next lesson's TITLE ONLY (Zeigarnik
//      effect → strongest cheap return-tomorrow hook). Big bold type.
//      Stoic close line "İyi geceler. Yarın görüşürüz." auto-closes
//      after 3s; user can also tap "Kapat".
//
// Modal presentation, no nav header. Always lets the user back out via
// the system gesture (modal swipe-down) at any moment. Skip link visible
// in the bottom-right corner so the modal never feels coercive.
//
// State side-effect: on completion, completeEveningClose() stamps today's
// date into eveningCloseCompletedAt and grantBonusXP(5) tops up XP. Both
// are idempotent — re-entering the screen the same day is harmless on
// the completion stamp, and we snapshot the "already done today" flag at
// mount to avoid double-granting the +5 XP.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '../contexts/AppContext';
import {
  PATHS,
  getPathById,
  getCurrentLesson,
} from '../data/paths';
import { hapticImpactLight, hapticSuccess } from '../services/haptics';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

// Today's date key — matches the format used by AppContext / cloudSync.
const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Reflection cap. Matches the reducer's defensive cap so the visible
// counter and the persisted value never disagree.
const REFLECTION_MAX = 280;

// Tomorrow intent options. Three archetypes the user can pre-commit to,
// each mapped to a hardcoded emoji + i18n label. Hardcoded fallback
// labels mean the picker never renders a raw i18n key on screen even
// if the locale block fails to load.
const INTENT_OPTIONS = [
  {
    id: 'discipline',
    emoji: '🔥',
    labelKey: 'eveningClose.intentDiscipline',
    fallback: 'Disiplin',
  },
  {
    id: 'focus',
    emoji: '🎯',
    labelKey: 'eveningClose.intentFocus',
    fallback: 'Odak',
  },
  {
    id: 'calm',
    emoji: '🌊',
    labelKey: 'eveningClose.intentCalm',
    fallback: 'Sakinlik',
  },
];

// Auto-close delay on Block C. Long enough to read the stoic close
// line + the next-lesson title, short enough that the user feels the
// ritual is done. Matches the Midday Pause's 2-second pattern but
// nudged up because Block C carries more text.
const BLOCK_C_AUTOCLOSE_MS = 3000;

export default function EveningCloseScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    completeEveningClose,
    saveEveningReflection,
    setTomorrowIntent: setTomorrowIntentAction,
    grantBonusXP,
    eveningCloseCompletedAt,
    eveningReflections,
    tomorrowIntent,
    activePathId,
    pathProgress,
  } = useApp();

  // Snapshot the "already done today" state on mount. Mirrors the Midday
  // Pause pattern: completeEveningClose is idempotent per-day, but
  // grantBonusXP keeps stacking, so we gate the XP grant on this ref.
  const alreadyDoneTodayRef = useRef(eveningCloseCompletedAt === getTodayKey());

  // Pre-fill the reflection input with whatever the user already wrote
  // today (if any), so re-entries don't lose their previous line. Only
  // read on mount — subsequent edits live in local state until they
  // commit by moving to Block B.
  const today = getTodayKey();
  const existingReflection = (eveningReflections || {})[today] || '';

  // ─── Block A state ───────────────────────────────────────────────────
  const [reflection, setReflection] = useState(existingReflection);
  const [reflectionCommitted, setReflectionCommitted] = useState(
    !!existingReflection,
  );
  const blockAOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(blockAOpacity, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [blockAOpacity]);

  const handleReflectionCommit = () => {
    const trimmed = reflection.trim();
    if (!trimmed) return;
    try { saveEveningReflection(trimmed); } catch {}
    setReflectionCommitted(true);
    hapticImpactLight();
  };

  // ─── Block B state ───────────────────────────────────────────────────
  // The user may have already committed an intent earlier today (e.g.
  // re-entered the modal). Re-derive the initial picked id from state
  // so we don't lose that signal.
  const tomorrowKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const initialIntent =
    tomorrowIntent && tomorrowIntent.date === tomorrowKey
      ? tomorrowIntent.intent
      : null;
  const [pickedIntent, setPickedIntent] = useState(initialIntent);

  const handleIntentPick = (intentId) => {
    if (pickedIntent === intentId) return; // single-shot per choice
    setPickedIntent(intentId);
    try { setTomorrowIntentAction(intentId); } catch {}
    hapticImpactLight();
  };

  // ─── Block C — Next lesson cliffhanger + auto-close ──────────────────
  // The cliffhanger is shown the moment the user picks an intent. We
  // resolve the next lesson's title via the same i18n key shape the
  // LessonScreen uses for its own "TOMORROW" teaser block, so the two
  // surfaces are guaranteed to agree.
  const activePath = useMemo(
    () => getPathById(activePathId) || PATHS[0],
    [activePathId],
  );
  const currentLesson = useMemo(
    () => getCurrentLesson(activePath, pathProgress),
    [activePath, pathProgress],
  );
  // Lesson title lives at lessons.<pathId>.<order>.title. If it's
  // missing (locale gap) or we somehow ran past the path, fall back to
  // a generic stoic line so we never render a raw i18n key on screen.
  const nextLessonTitle = useMemo(() => {
    if (!currentLesson || !activePath) return null;
    const key = `lessons.${activePath.id}.${currentLesson.order}.title`;
    const resolved = t(key, '');
    if (!resolved || resolved === key) return null;
    return resolved;
  }, [t, activePath, currentLesson]);

  const blockCOpacity = useRef(new Animated.Value(0)).current;
  const [completed, setCompleted] = useState(false);
  const autoCloseTimerRef = useRef(null);

  // Trigger Block C reveal + XP grant once the intent has been picked.
  // Order matters: we MUST defer the XP grant + completion stamp until
  // BOTH the reflection and intent are committed (otherwise a user who
  // skipped the reflection but picked an intent would silently bank
  // +5 XP).
  useEffect(() => {
    if (!pickedIntent) return;
    if (!reflectionCommitted) return; // both blocks required
    if (completed) return;

    // Fade-in Block C.
    Animated.timing(blockCOpacity, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    setCompleted(true);
    hapticSuccess();

    // Idempotent per-day completion stamp.
    try { completeEveningClose(); } catch {}
    // XP grant gated on per-mount snapshot.
    if (!alreadyDoneTodayRef.current) {
      try { grantBonusXP(5, 'eveningClose'); } catch {}
    }

    // Auto-close after BLOCK_C_AUTOCLOSE_MS so the user has a beat to
    // read the close line + next-lesson title. They can also tap
    // "Kapat" to leave instantly.
    autoCloseTimerRef.current = setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, BLOCK_C_AUTOCLOSE_MS);
  }, [
    pickedIntent,
    reflectionCommitted,
    completed,
    blockCOpacity,
    completeEveningClose,
    grantBonusXP,
    navigation,
  ]);

  const handleClose = () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleSkip = () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (navigation.canGoBack()) navigation.goBack();
  };

  // Cleanup lingering timers on unmount.
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header pill */}
          <View style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              {t('eveningClose.title', 'GÜNÜ KAPAT')}
            </Text>
          </View>
          <Text style={styles.headerHook}>
            {t('eveningClose.hook', '3 dakika. Günü kapat. Yarına yönel.')}
          </Text>

          {/* ── Block A: Bugün ne öğrendin? ──────────────────────────── */}
          <Animated.View
            style={[styles.blockWrap, { opacity: blockAOpacity }]}
          >
            <Text style={styles.blockPrompt}>
              {t('eveningClose.blockAPrompt', 'Bugün ne öğrendin?')}
            </Text>
            <Text style={styles.blockSub}>
              {t(
                'eveningClose.blockASub',
                'Tek satır. Kendine yaz.',
              )}
            </Text>

            <TextInput
              style={[
                styles.reflectionInput,
                reflectionCommitted && styles.reflectionInputCommitted,
              ]}
              value={reflection}
              onChangeText={(text) => {
                if (reflectionCommitted) return;
                // Hard-cap the input length client-side. The reducer
                // re-clamps defensively, but this gives the user a
                // visible "you've hit the limit" feel.
                if (text.length <= REFLECTION_MAX) {
                  setReflection(text);
                }
              }}
              placeholder={t(
                'eveningClose.blockAPlaceholder',
                'Bir cümle yeter…',
              )}
              placeholderTextColor={LT.outline}
              multiline
              maxLength={REFLECTION_MAX}
              editable={!reflectionCommitted}
              textAlignVertical="top"
            />
            <View style={styles.reflectionFooterRow}>
              <Text style={styles.reflectionCounter}>
                {reflection.length}/{REFLECTION_MAX}
              </Text>
              {!reflectionCommitted ? (
                <TouchableOpacity
                  style={[
                    styles.commitBtn,
                    !reflection.trim() && styles.commitBtnDisabled,
                  ]}
                  onPress={handleReflectionCommit}
                  activeOpacity={0.85}
                  disabled={!reflection.trim()}
                >
                  <Text style={styles.commitBtnText}>
                    {t('eveningClose.blockACommit', 'KAYDET')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.committedTick}>
                  {t('eveningClose.blockACommitted', '✓ kaydedildi')}
                </Text>
              )}
            </View>
          </Animated.View>

          {/* ── Block B: Yarın için tek niyet ────────────────────────── */}
          <View
            style={[
              styles.blockWrap,
              !reflectionCommitted && styles.blockDimmed,
            ]}
            pointerEvents={reflectionCommitted ? 'auto' : 'none'}
          >
            <Text style={styles.blockPrompt}>
              {t('eveningClose.blockBPrompt', 'Yarın için tek niyet.')}
            </Text>
            <Text style={styles.blockSub}>
              {t('eveningClose.blockBSub', 'Birini seç. Yarın sabah seni karşılayacak.')}
            </Text>
            <View style={styles.intentRow}>
              {INTENT_OPTIONS.map((opt) => {
                const isPicked = pickedIntent === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.intentCard,
                      isPicked && styles.intentCardPicked,
                      pickedIntent && !isPicked && styles.intentCardDimmed,
                    ]}
                    onPress={() => handleIntentPick(opt.id)}
                    activeOpacity={0.85}
                    disabled={!reflectionCommitted}
                  >
                    <Text style={styles.intentEmoji}>{opt.emoji}</Text>
                    <Text style={styles.intentLabel}>
                      {t(opt.labelKey, opt.fallback)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Block C: Cliffhanger + close ─────────────────────────── */}
          {completed ? (
            <Animated.View
              style={[styles.cliffhangerWrap, { opacity: blockCOpacity }]}
            >
              <Text style={styles.cliffhangerLabel}>
                {t('eveningClose.blockCLabel', 'YARIN')}
              </Text>
              {nextLessonTitle ? (
                <Text style={styles.cliffhangerTitle}>
                  {nextLessonTitle}
                </Text>
              ) : (
                <Text style={styles.cliffhangerTitle}>
                  {t(
                    'eveningClose.blockCFallback',
                    'Yeni bir gün, yeni bir adım.',
                  )}
                </Text>
              )}

              <View style={styles.closeBlock}>
                <Text style={styles.closeLine}>
                  {t(
                    'eveningClose.autoCloseLine',
                    'İyi geceler. Yarın görüşürüz.',
                  )}
                </Text>
                <Text style={styles.closeXp}>+5 XP</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={handleClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closeBtnText}>
                    {t('eveningClose.closeCta', 'KAPAT')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : null}

          <View style={{ height: 56 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Hairline skip — bottom right. Always available so the modal
          never feels coercive. Hidden once the ritual completes (the
          big Kapat button takes over). */}
      {!completed ? (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>
            {t('eveningClose.skip', 'Geç')}
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

  // Shared block wrapper
  blockWrap: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 4,
    alignItems: 'stretch',
    marginBottom: 22,
  },
  blockDimmed: {
    opacity: 0.4,
  },
  blockPrompt: {
    fontSize: 18,
    fontWeight: '800',
    color: LT.onSurface,
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  blockSub: {
    fontSize: 12,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    letterSpacing: 0.2,
    marginBottom: 14,
    textAlign: 'center',
  },

  // ── Block A: reflection input ───────────────────────────────────────
  reflectionInput: {
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    fontSize: 16,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 22,
  },
  reflectionInputCommitted: {
    backgroundColor: LT.surfaceContainer,
    borderColor: LT.outlineVariant,
    color: LT.onSurfaceVariant,
  },
  reflectionFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  reflectionCounter: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: LT.outline,
  },
  commitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.onSurface,
  },
  commitBtnDisabled: {
    backgroundColor: LT.outlineVariant,
  },
  commitBtnText: {
    color: LT.onPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  committedTick: {
    fontSize: 12,
    fontWeight: '800',
    color: LT.primaryContainer,
    letterSpacing: 0.4,
  },

  // ── Block B: intent picker ──────────────────────────────────────────
  intentRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  intentCard: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentCardPicked: {
    borderColor: LT.primaryContainer,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    transform: [{ scale: 1.04 }],
  },
  intentCardDimmed: {
    opacity: 0.4,
  },
  intentEmoji: {
    fontSize: 30,
    marginBottom: 6,
  },
  intentLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: LT.onSurface,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  // ── Block C: cliffhanger + close ────────────────────────────────────
  cliffhangerWrap: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginBottom: 18,
  },
  cliffhangerLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
    color: LT.primaryContainer,
    marginBottom: 12,
  },
  cliffhangerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: LT.onSurface,
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 34,
    marginBottom: 28,
    paddingHorizontal: 6,
  },
  closeBlock: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 6,
  },
  closeLine: {
    fontSize: 14,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  closeXp: {
    fontSize: 22,
    fontWeight: '900',
    color: LT.primaryContainer,
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  closeBtn: {
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
  closeBtnText: {
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
