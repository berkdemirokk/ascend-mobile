// AdDebugModal — Settings-only diagnostic panel for the ad system.
//
// Why this exists: when a user (or tester) reports "ads don't work,"
// the actual reason is almost always one of:
//   1. AdMob has no inventory yet (new account, fewer than ~100 daily
//      requests across the app). The error code is
//      `googleMobileAds/no-fill`. This is server-side and resolves
//      on its own.
//   2. SDK didn't initialize — usually because the user denied
//      notifications or quit the app before initAds ran.
//   3. Network glitch — `googleMobileAds/network-error`.
//   4. Bad config — wrong app id, paused ad unit, policy violation.
//
// The user can't see any of these without this panel. It surfaces:
//   - SDK init status, current loaded counts
//   - The exact ad unit IDs being requested (test vs production)
//   - The last 20 load attempts with their error codes
//   - ATT permission state (drives non-personalized ads)
//
// To open: Settings → bottom of the list → "Reklam Tanı (Debug)".
// Long-press if you want to make this gated to dev users later.

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { getAdSystemStatus, loadInterstitial, loadRewarded } from '../services/ads';
import { LT_RADIUS } from '../config/lightTheme';
import { useTheme, useThemedStyles } from '../config/theme';

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

export default function AdDebugModal({ visible, onClose }) {
  const { t } = useTranslation();
  const T = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Re-poll every 1s while open so live state stays fresh as the
  // user triggers re-loads from the action buttons below.
  const [status, setStatus] = useState(() => getAdSystemStatus());
  useEffect(() => {
    if (!visible) return undefined;
    setStatus(getAdSystemStatus());
    const id = setInterval(() => setStatus(getAdSystemStatus()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const handleShareReport = async () => {
    const lines = [
      'Ascend ad system diagnostics',
      '---',
      `SDK available: ${status.sdkAvailable}`,
      `Ads ready: ${status.adsReady}`,
      `Interstitial loaded: ${status.interstitialLoaded}`,
      `Rewarded loaded: ${status.rewardedLoaded}`,
      `Use test units: ${status.useTestUnits}`,
      `Tracking: ${status.trackingStatus} (personalized: ${status.personalizedAds})`,
      `Interstitial ID: ${status.interstitialId || '—'}`,
      `Rewarded ID: ${status.rewardedId || '—'}`,
      `Banner ID: ${status.bannerId || '—'}`,
      '',
      'Last 20 load attempts:',
      ...(status.diagnostics.length === 0
        ? ['  (none recorded yet)']
        : status.diagnostics
            .slice()
            .reverse()
            .map(
              (d) =>
                `  [${formatTime(d.ts)}] ${d.kind} → ${d.status}` +
                (d.code ? ` (${d.code})` : '') +
                (d.message ? ` — ${d.message}` : ''),
            )),
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('adDebug.title', 'Reklam Tanı')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color={T.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* State snapshot */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('adDebug.state', 'DURUM')}</Text>
            <Row
              label="SDK"
              value={status.sdkAvailable ? 'available' : 'missing'}
              ok={status.sdkAvailable}
              styles={styles}
            />
            <Row
              label="initAds"
              value={status.adsReady ? 'ready' : 'not ready'}
              ok={status.adsReady}
              styles={styles}
            />
            <Row
              label="Interstitial"
              value={status.interstitialLoaded ? 'loaded' : 'not loaded'}
              ok={status.interstitialLoaded}
              styles={styles}
            />
            <Row
              label="Rewarded"
              value={status.rewardedLoaded ? 'loaded' : 'not loaded'}
              ok={status.rewardedLoaded}
              styles={styles}
            />
            <Row
              label="Test units"
              value={status.useTestUnits ? 'YES (test)' : 'no (production)'}
              warn={status.useTestUnits}
              styles={styles}
            />
            <Row
              label="Tracking"
              value={status.trackingStatus}
              styles={styles}
            />
            <Row
              label="Personalized"
              value={status.personalizedAds ? 'yes' : 'no (ATT denied/undetermined)'}
              styles={styles}
            />
          </View>

          {/* Ad unit IDs */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('adDebug.unitIds', 'AD UNIT IDS')}</Text>
            <Text style={styles.mono}>Interstitial: {status.interstitialId || '—'}</Text>
            <Text style={styles.mono}>Rewarded: {status.rewardedId || '—'}</Text>
            <Text style={styles.mono}>Banner: {status.bannerId || '—'}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => loadInterstitial().catch(() => {})}
              activeOpacity={0.7}
              style={styles.actionBtn}
            >
              <MaterialIcons name="refresh" size={16} color={T.onSurface} />
              <Text style={styles.actionText}>
                {t('adDebug.loadInterstitial', 'Interstitial yükle')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => loadRewarded().catch(() => {})}
              activeOpacity={0.7}
              style={styles.actionBtn}
            >
              <MaterialIcons name="refresh" size={16} color={T.onSurface} />
              <Text style={styles.actionText}>
                {t('adDebug.loadRewarded', 'Rewarded yükle')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Last 20 attempts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('adDebug.diagnostics', 'SON 20 DENEME')}
            </Text>
            {status.diagnostics.length === 0 ? (
              <Text style={styles.emptyText}>
                {t(
                  'adDebug.empty',
                  'Henüz reklam yükleme girişimi kaydedilmedi. Yukarıdaki butonlardan birine bas, kayıt başlasın.',
                )}
              </Text>
            ) : (
              status.diagnostics
                .slice()
                .reverse()
                .map((d, i) => (
                  <View
                    key={`${d.ts}-${i}`}
                    style={[
                      styles.diagRow,
                      i < status.diagnostics.length - 1 && styles.diagBorder,
                    ]}
                  >
                    <View style={styles.diagHeader}>
                      <View
                        style={[
                          styles.statusDot,
                          d.status === 'loaded'
                            ? { backgroundColor: T.success }
                            : { backgroundColor: T.error },
                        ]}
                      />
                      <Text style={styles.diagTime}>{formatTime(d.ts)}</Text>
                      <Text style={styles.diagKind}>{d.kind}</Text>
                      <Text style={styles.diagStatus}>{d.status}</Text>
                    </View>
                    {d.code ? (
                      <Text style={styles.diagCode}>code: {d.code}</Text>
                    ) : null}
                    {d.message ? (
                      <Text style={styles.diagMessage}>{d.message}</Text>
                    ) : null}
                  </View>
                ))
            )}
          </View>

          {/* Help */}
          <View style={[styles.card, styles.helpCard]}>
            <Text style={styles.cardTitle}>{t('adDebug.help', 'YARDIM')}</Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>googleMobileAds/no-fill:</Text>{' '}
              AdMob'da bu uygulama için stok yok. Yeni hesaplarda 24-48 saat
              sürer. Kendi kendine çözülür.
            </Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>network-error:</Text> İnternet
              sorunu. Wi-Fi veya cellular kontrol et.
            </Text>
            <Text style={styles.helpText}>
              <Text style={styles.helpBold}>sdk_unavailable:</Text> AdMob
              native modülü yüklenmemiş. Build sorunu — yeniden derlemek
              gerekir.
            </Text>
          </View>

          {/* Share */}
          <TouchableOpacity
            onPress={handleShareReport}
            activeOpacity={0.8}
            style={styles.shareBtn}
          >
            <MaterialIcons name="share" size={18} color={T.onPrimary} />
            <Text style={styles.shareText}>
              {t('adDebug.share', 'Raporu paylaş')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ label, value, ok, warn, styles }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          ok === true && styles.rowValueOk,
          ok === false && styles.rowValueErr,
          warn === true && styles.rowValueWarn,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: T.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: T.surfaceContainer,
      borderBottomWidth: 1,
      borderBottomColor: T.outlineVariant,
    },
    title: {
      flex: 1,
      color: T.onSurface,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: { padding: 20 },
    card: {
      backgroundColor: T.surfaceContainerLowest,
      borderRadius: LT_RADIUS.lg,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: T.outlineVariant,
    },
    cardTitle: {
      color: T.onSurfaceVariant,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    rowLabel: {
      color: T.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '600',
    },
    rowValue: {
      color: T.onSurface,
      fontSize: 13,
      fontWeight: '700',
    },
    rowValueOk: { color: T.success },
    rowValueErr: { color: T.error },
    rowValueWarn: { color: '#D97706' },
    mono: {
      color: T.onSurface,
      fontSize: 12,
      fontFamily: 'Courier',
      marginBottom: 4,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: T.surfaceContainer,
      borderRadius: LT_RADIUS.lg,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: T.outlineVariant,
    },
    actionText: {
      color: T.onSurface,
      fontSize: 12,
      fontWeight: '700',
    },
    diagRow: {
      paddingVertical: 10,
    },
    diagBorder: {
      borderBottomWidth: 1,
      borderBottomColor: T.outlineVariant,
    },
    diagHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    diagTime: {
      color: T.onSurfaceVariant,
      fontSize: 11,
      fontFamily: 'Courier',
    },
    diagKind: {
      color: T.onSurface,
      fontSize: 12,
      fontWeight: '700',
    },
    diagStatus: {
      color: T.onSurfaceVariant,
      fontSize: 12,
    },
    diagCode: {
      color: T.primary,
      fontSize: 11,
      fontFamily: 'Courier',
      marginTop: 2,
      marginLeft: 16,
    },
    diagMessage: {
      color: T.onSurfaceVariant,
      fontSize: 11,
      marginTop: 2,
      marginLeft: 16,
    },
    emptyText: {
      color: T.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 18,
      fontStyle: 'italic',
    },
    helpCard: {
      backgroundColor: T.surfaceContainer,
    },
    helpText: {
      color: T.onSurfaceVariant,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 8,
    },
    helpBold: {
      fontWeight: '800',
      color: T.onSurface,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: T.primary,
      borderRadius: LT_RADIUS.lg,
      paddingVertical: 14,
    },
    shareText: {
      color: T.onPrimary,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
