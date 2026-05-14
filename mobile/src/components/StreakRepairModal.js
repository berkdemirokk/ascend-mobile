// StreakRepairModal — full-screen overlay shown when the user has just
// completed a lesson but their streak was broken (missed a day). Offers
// a 48-hour window to restore the streak via ad watch (free) or
// streak-freeze token (premium). Single highest-leverage retention
// feature in habit apps — Duolingo data shows +15-20% D30.
//
// Caller (LessonScreen celebration) is responsible for:
//   - reading `pendingStreakRestore` from useApp()
//   - rendering this modal when present
//   - calling restoreBrokenStreak() AFTER ad watched, or with useToken:true
//   - calling dismissBrokenStreakRestore() if the user opts out
//
// The actual ad show + reducer call is wired by the caller — this
// component is purely presentational so it stays testable.

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS } from '../config/lightTheme';
import { hapticImpactMedium } from '../services/haptics';

export default function StreakRepairModal({
  visible,
  brokenStreak,
  expiresAt,
  isPremium,
  streakFreezes = 0,
  rewardedReady = false,
  onWatchAd,        // () => Promise<boolean>  — caller shows rewarded ad
  onUseToken,       // () => void              — caller dispatches restore w/ token
  onDismiss,        // () => void              — caller dispatches dismiss
}) {
  const { t } = useTranslation();
  if (!visible) return null;

  // Compute hours-left for urgency framing. Capped at 48 since that's
  // the schedule, and at 1 (instead of 0) so we never show "0 hours left".
  const hoursLeft = (() => {
    if (!expiresAt) return 48;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));
  })();

  const canUseToken = isPremium && streakFreezes > 0;
  const canWatchAd = !isPremium && rewardedReady;

  const handleWatchAd = async () => {
    hapticImpactMedium();
    if (!onWatchAd) return;
    try {
      await onWatchAd();
    } catch {
      // caller handles errors; modal stays open if ad failed.
    }
  };

  const handleUseToken = () => {
    hapticImpactMedium();
    onUseToken?.();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.center}>
            <LinearGradient
              colors={['#1F0F0F', '#4A1A0F', '#7C2D12']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <Text style={styles.fireEmoji}>🔥</Text>
              <Text style={styles.brokenLabel}>
                {t('streakRepair.brokenLabel', 'STREAK BREAKED')}
              </Text>
              <View style={styles.streakRow}>
                <Text style={styles.streakNum}>{brokenStreak}</Text>
                <Text style={styles.streakNumLabel}>
                  {t('streakRepair.daysLabel', 'GÜN')}
                </Text>
              </View>
              <Text style={styles.title}>
                {t(
                  'streakRepair.title',
                  '{{n}} günlük serini geri al',
                  { n: brokenStreak },
                )}
              </Text>
              <Text style={styles.body}>
                {t(
                  'streakRepair.body',
                  'Dün bir gün kaçırdın. Bugün tamamladığın derste — {{hours}} saat içinde restore edebilirsin.',
                  { hours: hoursLeft },
                )}
              </Text>

              {/* Primary CTA — premium with tokens OR free with ad-ready */}
              {canUseToken ? (
                <TouchableOpacity
                  onPress={handleUseToken}
                  activeOpacity={0.85}
                  style={styles.primaryBtn}
                >
                  <MaterialIcons name="shield" size={20} color="#1F0F0F" />
                  <Text style={styles.primaryBtnText}>
                    {t(
                      'streakRepair.useTokenCta',
                      '1 jeton kullan ({{count}} kaldı)',
                      { count: streakFreezes },
                    )}
                  </Text>
                </TouchableOpacity>
              ) : canWatchAd ? (
                <TouchableOpacity
                  onPress={handleWatchAd}
                  activeOpacity={0.85}
                  style={styles.primaryBtn}
                >
                  <MaterialIcons name="play-circle-fill" size={20} color="#1F0F0F" />
                  <Text style={styles.primaryBtnText}>
                    {t('streakRepair.watchAdCta', 'Reklamı izle, geri al')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
                  <Text style={styles.primaryBtnTextDisabled}>
                    {t(
                      'streakRepair.unavailableCta',
                      isPremium
                        ? 'Jeton yok — premium\'da ayda 12 jeton alırsın'
                        : 'Reklam yükleniyor...',
                    )}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={onDismiss}
                activeOpacity={0.7}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissBtnText}>
                  {t('streakRepair.dismissCta', 'Serini bırak')}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: LT_RADIUS.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#7C2D12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  fireEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  brokenLabel: {
    color: '#FED7AA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 16,
  },
  streakNum: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 64,
  },
  streakNumLabel: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: '#FED7AA',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FED7AA',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
  },
  primaryBtnText: {
    color: '#1F0F0F',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  primaryBtnDisabled: {
    backgroundColor: 'rgba(254, 215, 170, 0.3)',
  },
  primaryBtnTextDisabled: {
    color: '#FED7AA',
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.7,
  },
  dismissBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dismissBtnText: {
    color: 'rgba(254, 215, 170, 0.6)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },
});
