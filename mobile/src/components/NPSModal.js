// NPSModal — in-app Net Promoter Score prompt.
//
// Why this exists: we were flying blind on retention complaints ("anlamsız
// geliyor") with no actual user-feedback data flowing in. This is the
// data-starvation fix.
//
// Triggers (one-shot per user, set by AppContext reducer in
// COMPLETE_PATH_LESSON):
//   - lesson-3   : after the 3rd lesson EVER. Sweet spot — user has formed
//                  an opinion (good or bad) but isn't yet checked out.
//   - streak-14  : after the 14-day streak. The "habit formed" moment;
//                  NPS here filters for users who actually stuck with it.
//
// Lifecycle: the modal OWNS its lifecycle. Caller (LessonScreen) just
// renders <NPSModal> overlay when _npsToast is set; on submit/dismiss the
// modal calls AppContext callbacks (submitNps, dismissNps). The modal
// renders ON TOP of the celebration with a slight backdrop fade — the
// user still sees their lesson completion as context.

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';

import { LT, LT_RADIUS } from '../config/lightTheme';
import { supabase, SUPABASE_CONFIGURED } from '../services/supabase';
import { getCurrentLanguage } from '../i18n';
import { hapticImpactLight } from '../services/haptics';

const COMMENT_MAX = 280;
const THANKS_AUTO_CLOSE_MS = 1500;

// Localized "Why did you give this score?" prompt — varies by band so the
// open-text question is actually relevant to what the user just rated.
function getStep2Title(t, score) {
  if (score == null) return '';
  if (score <= 6) return t('nps.lowScore', 'Ne kötü gidiyor? Tek cümle yeter.');
  if (score <= 8) return t('nps.midScore', 'Ne eksik kalıyor? Dürüst ol.');
  return t('nps.highScore', 'Ne işine yarıyor en çok?');
}

export default function NPSModal({
  visible,
  trigger,        // 'lesson-3' | 'streak-14'
  userId,         // string | null — null for guest mode
  anonUsername,   // string | null
  onSubmit,       // ({ trigger, askedAt }) => void   (AppContext.submitNps)
  onDismiss,      // ({ permanent }) => void          (AppContext.dismissNps)
}) {
  const { t } = useTranslation();
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState(1); // 1 = score, 2 = comment, 3 = thanks
  const [submitting, setSubmitting] = useState(false);

  // Step transition + thanks-screen fade. Native driver where possible.
  const stepAnim = useRef(new Animated.Value(0)).current;

  // Reset when re-opened. Important so the same modal works for both
  // triggers across the same session.
  useEffect(() => {
    if (visible) {
      setScore(null);
      setComment('');
      setStep(1);
      stepAnim.setValue(0);
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, stepAnim]);

  // Auto-close after thanks step is shown. We close via onDismiss with
  // `permanent: false` — the local stamp has already been done in
  // handleSubmit (synchronously after the supabase insert), so this
  // call is purely the visual modal-close. The `permanent: false`
  // ensures DISMISS_NPS_TOAST in the reducer just nulls `_npsToast`
  // without re-stamping (idempotent either way, but cleaner intent).
  useEffect(() => {
    if (step !== 3) return undefined;
    const timer = setTimeout(() => {
      onDismiss?.({ permanent: false });
    }, THANKS_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [step, onDismiss]);

  const handlePickScore = (n) => {
    hapticImpactLight();
    setScore(n);
    // Animate to step 2.
    setStep(2);
  };

  const handleSubmit = async () => {
    if (score == null || submitting) return;
    setSubmitting(true);

    // Send to Supabase. Graceful fail — we still stamp the local
    // *AskedAt no matter what so the user doesn't see this again on
    // their next lesson because of a transient network blip.
    if (SUPABASE_CONFIGURED) {
      try {
        const version =
          Constants?.expoConfig?.version
          || Constants?.manifest?.version
          || null;
        await supabase.from('nps_responses').insert({
          user_id: userId || null,
          anon_username: anonUsername || null,
          score,
          comment: comment ? comment.trim().slice(0, COMMENT_MAX) : null,
          trigger,
          app_version: version,
          locale: getCurrentLanguage(),
        });
      } catch (e) {
        console.warn('[NPSModal] supabase insert failed:', e?.message);
      }
    }

    setSubmitting(false);
    // Stamp `*AskedAt` IMMEDIATELY after the supabase insert (or its
    // graceful failure) so the user is never re-prompted for this
    // trigger — even if they background the app before the 1.5s
    // thanks-auto-close fires and the timeout never gets a chance to
    // call onSubmit. The visual auto-close still happens via the
    // effect below; this is just the persistence half.
    onSubmit?.({ trigger });
    setStep(3); // Show thanks screen; the effect auto-closes after 1.5s.
  };

  const handleSkip = () => {
    // "Atla" — submits with empty comment (still grabs the score).
    if (score == null) {
      onDismiss?.({ permanent: true });
      return;
    }
    setComment('');
    handleSubmit();
  };

  const handleHardClose = () => {
    onDismiss?.({ permanent: true });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleHardClose}
      statusBarTranslucent
    >
      {/* Slight fade — the celebration screen behind stays visible as
          context so the user remembers what they just accomplished. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: stepAnim,
              transform: [
                {
                  translateY: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {step === 1 && (
            <View>
              <Text style={styles.title}>
                {t('nps.title', 'Bir saniye.')}
              </Text>
              <Text style={styles.question}>
                {t(
                  'nps.question',
                  'Bu uygulamayı bir arkadaşına önerir misin?',
                )}
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scaleRow}
              >
                {Array.from({ length: 11 }, (_, n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => handlePickScore(n)}
                    activeOpacity={0.7}
                    style={styles.scaleBtn}
                  >
                    <Text style={styles.scaleBtnText}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.scaleLabelRow}>
                <Text style={styles.scaleLabel}>
                  {t('nps.scaleLowLabel', 'Asla')}
                </Text>
                <Text style={styles.scaleLabel}>
                  {t('nps.scaleHighLabel', 'Kesin tavsiye')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleHardClose}
                activeOpacity={0.7}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissBtnText}>
                  {t('nps.skipCta', 'Atla')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>{getStep2Title(t, score)}</Text>
              <View style={styles.scoreChip}>
                <Text style={styles.scoreChipText}>{score}/10</Text>
              </View>

              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder={t(
                  'nps.placeholder',
                  'Birkaç kelime yeter…',
                )}
                placeholderTextColor="#8A8A8A"
                multiline
                maxLength={COMMENT_MAX}
                style={styles.input}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {comment.length} / {COMMENT_MAX}
              </Text>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || score == null}
                activeOpacity={0.85}
                style={[
                  styles.primaryBtn,
                  (submitting || score == null) && styles.primaryBtnDisabled,
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {t('nps.submitCta', 'Gönder')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSkip}
                activeOpacity={0.7}
                style={styles.dismissBtn}
                disabled={submitting}
              >
                <Text style={styles.dismissBtnText}>
                  {t('nps.skipCta', 'Atla')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.thanksWrap}>
              <Text style={styles.thanksTitle}>
                {t('nps.thanksTitle', 'Teşekkürler.')}
              </Text>
              <Text style={styles.thanksBody}>
                {t('nps.thanksBody', 'Sözünü unutmadık.')}
              </Text>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Backdrop is intentionally darker than other modals (rgba(0,0,0,0.55)
  // not 0.85) so the celebration scene behind stays as context. We
  // explicitly want the user to see what they just finished while we ask.
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },

  // Stoic register — "Bir saniye." not "Sevdin mi?". A beat, not a beg.
  title: {
    color: LT.onSurface,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  question: {
    color: LT.onSurfaceVariant,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 18,
  },

  // 11-button 0-10 row. ~32px each fits on iPhone SE (smallest target).
  // ScrollView wrap so anything narrower still works without breaking.
  scaleRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  scaleBtn: {
    width: 32,
    height: 36,
    borderRadius: 10,
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleBtnText: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
  },
  scaleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 14,
  },
  scaleLabel: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Step 2 — score recap chip + comment input.
  scoreChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderColor: 'rgba(227, 18, 18, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  scoreChipText: {
    color: LT.primaryContainer,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 84,
    maxHeight: 140,
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: LT.onSurface,
    fontWeight: '500',
  },
  charCount: {
    alignSelf: 'flex-end',
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 14,
  },

  // Primary CTA — solid red brand button, full-width.
  primaryBtn: {
    backgroundColor: LT.primaryContainer,
    paddingVertical: 14,
    borderRadius: LT_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: LT.onPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  dismissBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },

  // Thanks screen — brief beat, then auto-close.
  thanksWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  thanksTitle: {
    color: LT.onSurface,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  thanksBody: {
    color: LT.onSurfaceVariant,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
