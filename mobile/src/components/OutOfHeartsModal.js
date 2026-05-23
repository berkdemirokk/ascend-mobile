// OutOfHeartsModal — shown when hearts === 0 and user tries to start a lesson.
// Two paths to refill: watch a rewarded ad OR upgrade to premium.
// Vivid Impact light theme.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  showRewarded,
  isAdsReady,
  isRewardedReady,
  loadRewarded,
  getAdDiagnostics,
} from '../services/ads';
import LiveCountdown from './LiveCountdown';
import { LT, LT_RADIUS } from '../config/lightTheme';

export default function OutOfHeartsModal({
  visible,
  onClose,
  onRefill,
  onPaywall,
  // Either pass refillAt (preferred — live ticking countdown) OR
  // refillMins (legacy static value, kept for back-compat).
  refillAt = null,
  refillMins = null,
}) {
  const { t } = useTranslation();
  const [watching, setWatching] = useState(false);
  // Rewarded ad readiness is dynamic — an ad may load AFTER the modal
  // opens. Poll every 500ms while visible so the "Watch ad" button
  // can appear mid-session if an ad becomes available.
  const [rewardedReady, setRewardedReady] = useState(
    () => isAdsReady() && isRewardedReady(),
  );
  useEffect(() => {
    if (!visible) {
      // Modal closed — explicitly clear any stuck "watching" state so
      // a re-open never starts in the disabled spinner.
      setWatching(false);
      return undefined;
    }
    setRewardedReady(isAdsReady() && isRewardedReady());
    const id = setInterval(() => {
      setRewardedReady(isAdsReady() && isRewardedReady());
    }, 500);
    return () => clearInterval(id);
  }, [visible]);

  // Cancellation token for the slow-path polling loop. If the user
  // closes the modal mid-poll, the loop bails out so we don't call
  // showRewarded() after onClose (which would silently fail and
  // leave the user with no feedback).
  const cancelledRef = useRef(false);
  useEffect(() => {
    if (!visible) cancelledRef.current = true;
    else cancelledRef.current = false;
  }, [visible]);

  // Try to show a rewarded ad. If one isn't loaded yet, trigger a
  // load and poll for up to ~6 seconds before giving up. The old
  // version bailed instantly with "ad not ready", which felt broken
  // — users would tap, see an alert, and assume the feature was
  // dead. Now we make a real attempt before showing the failure
  // alert, and the spinner tells the user we're working on it.
  const handleWatchAd = async () => {
    if (watching) return;
    setWatching(true);
    try {
      // Fast path — ad is already cached.
      if (isRewardedReady()) {
        const earned = await showRewarded();
        if (earned) {
          onRefill?.();
          onClose?.();
          // No early return — fall through to setWatching(false) in
          // the finally block below. The old code returned here
          // without resetting `watching`, so the next time the modal
          // re-opened the button was permanently stuck in
          // "REKLAM YÜKLENİYOR..." with no way to recover.
        }
      } else {
        // Slow path — kick off a load and poll. AdMob usually
        // serves a fresh ad in 1-3s on production traffic. We give
        // up to ~6s with a 400ms poll interval.
        try {
          loadRewarded().catch(() => {});
        } catch {}
        const startedAt = Date.now();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (cancelledRef.current) return; // user closed modal
          if (isRewardedReady()) break;
          if (Date.now() - startedAt > 6000) break;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 400));
        }
        if (cancelledRef.current) return; // double-check after sleep
        if (isRewardedReady()) {
          const earned = await showRewarded();
          if (earned) {
            onRefill?.();
            onClose?.();
            // Fall through to finally — no early return.
          }
        }
      }
      // Still no ad after the wait, or the user dismissed early.
      // Surface the LAST RECORDED error code so the user (and we,
      // when they screenshot it to us) can see exactly why. The most
      // common code for a brand-new AdMob account is
      // "googleMobileAds/no-fill" — meaning AdMob has no inventory
      // matching this app yet. That's a server-side issue, NOT a
      // bug in our code, and it usually resolves on its own as the
      // app accumulates request history (24-48 hours).
      const diag = getAdDiagnostics();
      const lastRewardedErr = [...diag]
        .reverse()
        .find((d) => d.kind === 'rewarded' && d.status === 'error');
      const codeHint = lastRewardedErr?.code
        ? `\n\n(Kod: ${lastRewardedErr.code})`
        : '';
      const baseBody = t(
        'hearts.adNotReadyBody',
        'Şu an reklam servisinden cevap gelmedi. Bir kaç saniye sonra tekrar dene veya Premium\'a geçerek reklamsız + sınırsız kalp al.',
      );
      Alert.alert(
        t('hearts.adNotReadyTitle', 'Reklam yüklenemedi'),
        baseBody + codeHint,
      );
    } catch {
      // Swallow — the most common reason here is `showRewarded` rejecting
      // (cancelled, dismissed mid-show). User already gets feedback via
      // the alert above when the failure path runs.
    } finally {
      // Always reset, regardless of which branch we took. The OLD code
      // had `setWatching(false)` outside the try (NOT a finally) AND
      // had early returns in the success path, so a successful refill
      // left `watching=true` forever — re-opening the modal showed the
      // disabled spinner permanently. This is THE fix for that.
      setWatching(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color={LT.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.heartIcon}>
            <MaterialIcons
              name="heart-broken"
              size={56}
              color={LT.primaryContainer}
            />
          </View>

          <Text style={styles.title}>
            {t('hearts.outTitle', 'Kalpler Bitti')}
          </Text>
          <Text style={styles.subtitle}>
            {t(
              'hearts.outSubtitle',
              "Devam etmek için kalp gerekli. Reklam izleyerek 1 kalp kazan veya Premium'a geç.",
            )}
          </Text>

          {refillAt ? (
            // Live ticking countdown — updates every second to keep the
            // user watching the clock tick toward zero. Creates urgency
            // without needing the modal parent to manage state.
            <View style={styles.timerPill}>
              <MaterialIcons name="timer" size={14} color={LT.onSurfaceVariant} />
              <LiveCountdown
                target={refillAt}
                format="m:ss"
                style={styles.timerText}
              >
                {t('hearts.refillIn', { mins: '{time}' })}
              </LiveCountdown>
            </View>
          ) : refillMins !== null && refillMins > 0 ? (
            <View style={styles.timerPill}>
              <MaterialIcons name="timer" size={14} color={LT.onSurfaceVariant} />
              <Text style={styles.timerText}>
                {t('hearts.refillIn', { mins: refillMins })}
              </Text>
            </View>
          ) : null}

          {/* Watch ad CTA — ALWAYS rendered now. The old code only
              showed this button when isRewardedReady() returned true,
              which meant a brand-new user (or any user where AdMob
              hadn't loaded a fill yet) saw ONLY the Premium button.
              They reported "reklam izle çıkmıyo" — exactly the bug.
              We now always show the button; handleWatchAd does the
              load-and-poll work, and falls back to a clear error
              alert if no ad becomes available within 6 seconds. */}
          <TouchableOpacity
            onPress={handleWatchAd}
            disabled={watching}
            activeOpacity={0.85}
            style={[styles.watchAdBtn, watching && { opacity: 0.7 }]}
          >
            <View style={styles.watchAdContent}>
              {watching ? (
                <>
                  <ActivityIndicator color={LT.onSurface} size="small" />
                  <Text style={styles.watchAdText}>
                    {t('hearts.adLoading', 'REKLAM YÜKLENİYOR...')}
                  </Text>
                </>
              ) : (
                <>
                  <MaterialIcons
                    name="play-circle"
                    size={20}
                    color={LT.onSurface}
                  />
                  <Text style={styles.watchAdText}>
                    {t('hearts.watchAd', 'REKLAM İZLE, +1 KALP KAZAN')}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Premium CTA — primary red */}
          <TouchableOpacity
            onPress={onPaywall}
            activeOpacity={0.85}
            style={styles.premiumBtn}
          >
            <MaterialIcons name="workspace-premium" size={18} color={LT.onPrimary} />
            <Text style={styles.premiumText}>
              {t('hearts.goPremium', "PREMIUM İLE SINIRSIZ KALPLER")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('common.later', 'Sonra')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 28, 28, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainer,
  },
  heartIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: LT.onSurface,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LT.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    marginBottom: 20,
  },
  timerText: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
  },

  watchAdBtn: {
    width: '100%',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: LT.onSurface,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  watchAdContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  watchAdText: {
    color: LT.onSurface,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  premiumBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: LT.primaryContainer,
    borderRadius: LT_RADIUS.lg,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 4,
  },
  premiumText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  skipBtn: {
    marginTop: 14,
    paddingVertical: 6,
  },
  skipText: {
    color: LT.outline,
    fontSize: 12,
    fontWeight: '700',
  },
});
