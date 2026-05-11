// SageMode — Premium-only audio-guided deep session that turns a 5-min
// lesson into a ~15-min immersive experience. The "wow moment" premium
// feature that makes the upgrade feel qualitatively different.
//
// Four phases:
//   1. BREATH (60s)   — animated breath circle, 4-7-8 pattern cue
//   2. AUDIO          — TTS reads the lesson teaching aloud (3-6 min)
//   3. DEEP_PROMPT    — 3 layered reflection questions, single combined
//                       text input
//   4. COMMIT         — user types/confirms their action commitment,
//                       sage closes with a quote
//
// Free users tap "Sage Mode" → paywall. Premium users tap → modal.
// On completion, awards +30 XP bonus (sent to caller via onComplete).

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  TextInput,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { speak, stop as stopTts } from '../services/tts';
import { getCurrentLanguage } from '../i18n';
import {
  hapticImpactLight,
  hapticImpactMedium,
  hapticSuccess,
  hapticMilestone,
} from '../services/haptics';

const PHASE = {
  BREATH: 'breath',
  AUDIO: 'audio',
  REFLECT: 'reflect',
  COMMIT: 'commit',
  DONE: 'done',
};

const BREATH_DURATION_MS = 60_000;

export default function SageMode({
  visible,
  lesson,
  teaching,
  action,
  onClose,
  onComplete,
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(PHASE.BREATH);
  const [breathProgress, setBreathProgress] = useState(0);
  const [reflection, setReflection] = useState('');
  const [commitment, setCommitment] = useState('');
  const breathCircle = useRef(new Animated.Value(0.5)).current;
  const breathTimer = useRef(null);

  // Reset state every time modal becomes visible (so re-opens start fresh).
  useEffect(() => {
    if (!visible) return;
    setPhase(PHASE.BREATH);
    setBreathProgress(0);
    setReflection('');
    setCommitment('');
    return () => {
      try { stopTts(); } catch {}
      if (breathTimer.current) clearInterval(breathTimer.current);
    };
  }, [visible]);

  // ── PHASE 1: Breathing ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible || phase !== PHASE.BREATH) return;
    // 4-7-8 breath pattern via simple inhale/hold/exhale animation cycle.
    // We loop 4 cycles (~60s total). Animation drives the circle scale.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathCircle, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(7000),
        Animated.timing(breathCircle, { toValue: 0.5, duration: 8000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    loop.start();

    const startedAt = Date.now();
    breathTimer.current = setInterval(() => {
      const pct = Math.min(1, (Date.now() - startedAt) / BREATH_DURATION_MS);
      setBreathProgress(pct);
      if (pct >= 1) {
        clearInterval(breathTimer.current);
        breathTimer.current = null;
        loop.stop();
        hapticSuccess();
        setPhase(PHASE.AUDIO);
      }
    }, 500);

    return () => {
      loop.stop();
      if (breathTimer.current) clearInterval(breathTimer.current);
    };
  }, [visible, phase, breathCircle]);

  // ── PHASE 2: TTS audio narration of the lesson ──────────────────────
  useEffect(() => {
    if (!visible || phase !== PHASE.AUDIO) return;
    if (!teaching) {
      // No teaching text → skip straight to reflection
      setPhase(PHASE.REFLECT);
      return;
    }
    const lang = getCurrentLanguage();
    const ttsLang = String(lang || 'tr').toLowerCase().slice(0, 2) === 'en'
      ? 'en-US'
      : 'tr-TR';
    let done = false;
    speak(teaching, {
      language: ttsLang,
      rate: 0.92, // slightly slower than default — sage tone
      onDone: () => {
        if (done) return;
        done = true;
        hapticSuccess();
        setPhase(PHASE.REFLECT);
      },
      onError: () => {
        if (done) return;
        done = true;
        setPhase(PHASE.REFLECT);
      },
    });
    return () => {
      try { stopTts(); } catch {}
    };
  }, [visible, phase, teaching]);

  // ── Skip handlers ────────────────────────────────────────────────────
  const skipBreath = () => {
    hapticImpactLight();
    if (breathTimer.current) clearInterval(breathTimer.current);
    setPhase(PHASE.AUDIO);
  };

  const skipAudio = () => {
    try { stopTts(); } catch {}
    hapticImpactLight();
    setPhase(PHASE.REFLECT);
  };

  const submitReflect = () => {
    hapticImpactMedium();
    setPhase(PHASE.COMMIT);
  };

  const finishSession = () => {
    hapticMilestone();
    setPhase(PHASE.DONE);
    // Award +30 XP via caller. Reflection + commitment text not
    // currently persisted — caller can extend if desired.
    onComplete?.({ bonusXp: 30, reflection, commitment });
  };

  // ── Render ──────────────────────────────────────────────────────────
  if (!visible) return null;

  const breathScale = breathCircle.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0.7, 1.15],
  });

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <LinearGradient
        colors={['#0F0A1E', '#1E1B4B', '#312E81']}
        style={styles.root}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Close button — always present, but stops TTS first */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => {
                  try { stopTts(); } catch {}
                  if (breathTimer.current) clearInterval(breathTimer.current);
                  onClose?.();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <MaterialIcons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.phaseLabel}>
                {phase === PHASE.BREATH && t('sage.phaseBreath', 'BREATHE')}
                {phase === PHASE.AUDIO && t('sage.phaseAudio', 'LISTEN')}
                {phase === PHASE.REFLECT && t('sage.phaseReflect', 'REFLECT')}
                {phase === PHASE.COMMIT && t('sage.phaseCommit', 'COMMIT')}
                {phase === PHASE.DONE && t('sage.phaseDone', 'COMPLETE')}
              </Text>
              <View style={{ width: 22 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {phase === PHASE.BREATH && (
                <View style={styles.breathWrap}>
                  <Text style={styles.bigLabel}>
                    {t('sage.breathTitle', 'Breathe with the circle')}
                  </Text>
                  <Animated.View
                    style={[styles.breathCircle, { transform: [{ scale: breathScale }] }]}
                  />
                  <Text style={styles.bigSub}>
                    {t('sage.breathSub', '4 in · 7 hold · 8 out')}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${breathProgress * 100}%` }]} />
                  </View>
                  <TouchableOpacity onPress={skipBreath} style={styles.skipBtn}>
                    <Text style={styles.skipText}>{t('sage.skip', 'Skip')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {phase === PHASE.AUDIO && (
                <View style={styles.audioWrap}>
                  <Text style={styles.bigLabel}>
                    {t('sage.audioTitle', 'Listen with full attention')}
                  </Text>
                  <View style={styles.audioOrb}>
                    <MaterialIcons name="graphic-eq" size={48} color="#FDE047" />
                  </View>
                  <Text style={styles.bigSub}>
                    {t('sage.audioSub', "The sage reads today's teaching")}
                  </Text>
                  <TouchableOpacity onPress={skipAudio} style={styles.skipBtn}>
                    <Text style={styles.skipText}>{t('sage.skip', 'Skip')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {phase === PHASE.REFLECT && (
                <View style={styles.reflectWrap}>
                  <Text style={styles.bigLabel}>
                    {t('sage.reflectTitle', 'Three questions')}
                  </Text>
                  <Text style={styles.reflectPrompt}>
                    {t('sage.reflectQ1', '1. What did this teaching make you feel?')}
                  </Text>
                  <Text style={styles.reflectPrompt}>
                    {t('sage.reflectQ2', '2. Where does this show up in your life right now?')}
                  </Text>
                  <Text style={styles.reflectPrompt}>
                    {t('sage.reflectQ3', '3. What would change if you lived this for a week?')}
                  </Text>
                  <TextInput
                    value={reflection}
                    onChangeText={setReflection}
                    placeholder={t('sage.reflectPlaceholder', 'Write your answer...')}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    multiline
                    style={styles.input}
                  />
                  <TouchableOpacity onPress={submitReflect} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>
                      {t('sage.next', 'Continue')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {phase === PHASE.COMMIT && (
                <View style={styles.commitWrap}>
                  <Text style={styles.bigLabel}>
                    {t('sage.commitTitle', 'Your commitment')}
                  </Text>
                  <Text style={styles.actionEcho}>
                    {action || t('sage.commitDefault', 'One small action today.')}
                  </Text>
                  <Text style={styles.commitPrompt}>
                    {t('sage.commitPrompt', 'How will you do this today?')}
                  </Text>
                  <TextInput
                    value={commitment}
                    onChangeText={setCommitment}
                    placeholder={t('sage.commitPlaceholder', 'Type your specific plan...')}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    multiline
                    style={styles.input}
                  />
                  <TouchableOpacity onPress={finishSession} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>
                      {t('sage.finish', 'Seal the session')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {phase === PHASE.DONE && (
                <View style={styles.doneWrap}>
                  <Text style={styles.doneEmoji}>🧘</Text>
                  <Text style={styles.doneTitle}>
                    {t('sage.doneTitle', 'Session complete.')}
                  </Text>
                  <Text style={styles.doneSub}>
                    {t('sage.doneSub', '+30 XP · Carry this with you today.')}
                  </Text>
                  <TouchableOpacity onPress={onClose} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>
                      {t('sage.close', 'Step back into the world')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  phaseLabel: {
    color: '#FDE047',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // ── Breath phase ───────────────────────────────────────────────
  breathWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  breathCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(253, 224, 71, 0.2)',
    borderWidth: 2,
    borderColor: '#FDE047',
    marginVertical: 28,
  },

  // ── Audio phase ────────────────────────────────────────────────
  audioWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  audioOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(253, 224, 71, 0.12)',
    borderWidth: 2,
    borderColor: '#FDE047',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
  },

  // ── Reflect & Commit phases ───────────────────────────────────
  reflectWrap: { paddingTop: 18 },
  commitWrap: { paddingTop: 18 },
  reflectPrompt: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 6,
    fontWeight: '500',
  },
  actionEcho: {
    color: '#FDE047',
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    marginVertical: 14,
    lineHeight: 22,
  },
  commitPrompt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 100,
    marginTop: 14,
    marginBottom: 18,
    textAlignVertical: 'top',
  },

  // ── Done phase ─────────────────────────────────────────────────
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  doneEmoji: { fontSize: 100, marginBottom: 18 },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  doneSub: {
    color: '#FDE047',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 28,
  },

  // ── Shared ─────────────────────────────────────────────────────
  bigLabel: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  bigSub: {
    color: '#FFFFFF',
    opacity: 0.85,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    width: 200,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 24,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FDE047',
  },
  skipBtn: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#FDE047',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#1E1B4B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
