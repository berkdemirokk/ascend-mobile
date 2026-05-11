// OutOfHeartsModal — shown when hearts === 0 and user tries to start a lesson.
// Two paths to refill: watch a rewarded ad OR upgrade to premium.
// Vivid Impact light theme.

import React, { useState } from 'react';
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
import { showRewarded, isAdsReady, isRewardedReady } from '../services/ads';
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
  const rewardedReady = isAdsReady() && isRewardedReady();

  const handleWatchAd = async () => {
    if (watching) return;
    setWatching(true);
    try {
      const earned = await showRewarded();
      if (earned) {
        onRefill?.();
        onClose?.();
      } else {
        // Ad failed to show or user closed early. New AdMob accounts often
        // serve no fill — make this visible so the tap doesn't feel broken.
        Alert.alert(
          t('hearts.adNotReadyTitle', 'Reklam hazır değil'),
          t(
            'hearts.adNotReadyBody',
            'Şu an gösterilebilecek bir reklam yok. Birazdan tekrar dene ya da Premium\'a geçerek reklamsız + sınırsız kalp al.',
          ),
        );
      }
    } catch {}
    setWatching(false);
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

          {/* Watch ad CTA — only render when an ad is actually loaded so we
              don't show a button that silently fails on tap. */}
          {rewardedReady ? (
            <TouchableOpacity
              onPress={handleWatchAd}
              disabled={watching}
              activeOpacity={0.85}
              style={styles.watchAdBtn}
            >
              <View style={styles.watchAdContent}>
                {watching ? (
                  <ActivityIndicator color={LT.onSurface} />
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
          ) : null}

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
