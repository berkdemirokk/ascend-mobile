// WhatsNewModal — shown ONCE after the user updates the app to a
// version that's listed in WHATS_NEW. Triggered from App.js by
// useWhatsNew(); this file owns only the visual presentation +
// the per-version copy.
//
// Design intent:
//   - Friendly, not promotional. The user already updated; we're
//     not selling, we're informing.
//   - Max 3 bullets. The audit's lesson: anything past 3 is skim-
//     past noise.
//   - One "Got it" button. No secondary "Don't show again" — this
//     is already once-per-version.
//
// To announce a new version: add a new entry to WHATS_NEW keyed by
// the exact `Constants.expoConfig.version` string. Versions missing
// from the map silently skip the modal (e.g. patch releases with
// no user-facing change).

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { LT_RADIUS } from '../config/lightTheme';
import { useTheme, useThemedStyles } from '../config/theme';

/**
 * Per-version copy. The TR + EN translations live in i18n under the
 * `whatsNew.<version>.*` namespace; this map only carries the icon
 * names + the structural list of bullets. Keep both locales in sync
 * when adding a new release.
 */
export const WHATS_NEW = {
  '1.0.32': {
    icon: 'rocket-launch',
    titleKey: 'whatsNew.v1_0_32.title',
    titleDefault: 'Yeni özellikler geldi',
    bullets: [
      {
        icon: 'dark-mode',
        key: 'whatsNew.v1_0_32.dark',
        default:
          'Karanlık mod — Sistem temasını otomatik takip eder. Geceleri daha rahat.',
      },
      {
        icon: 'card-giftcard',
        key: 'whatsNew.v1_0_32.referral',
        default:
          'Davet sistemi — Arkadaşına kodu gönder, ikiniz de 10 streak dondurma jetonu kazanın.',
      },
    ],
    ctaKey: 'whatsNew.v1_0_32.cta',
    ctaDefault: 'Anladım, halkamı kurmaya başlayayım',
  },
};

export default function WhatsNewModal({ visible, version, onDismiss }) {
  const { t } = useTranslation();
  const T = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Defensive: if the modal was triggered for a version we don't have
  // copy for, just dismiss immediately so we don't show an empty card.
  const entry = version ? WHATS_NEW[version] : null;
  if (!entry) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Hero icon */}
          <View style={styles.iconWrap}>
            <MaterialIcons
              name={entry.icon}
              size={32}
              color={T.onPrimary}
            />
          </View>

          {/* Version pill */}
          <Text style={styles.versionPill}>v{version}</Text>

          {/* Title */}
          <Text style={styles.title}>
            {t(entry.titleKey, entry.titleDefault)}
          </Text>

          {/* Bullets */}
          <ScrollView
            style={styles.bulletList}
            showsVerticalScrollIndicator={false}
          >
            {entry.bullets.map((b, idx) => (
              <View key={b.key} style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <MaterialIcons
                    name={b.icon}
                    size={20}
                    color={T.primaryContainer}
                  />
                </View>
                <Text style={styles.bulletText}>
                  {t(b.key, b.default)}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* CTA */}
          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.85}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>
              {t(entry.ctaKey, entry.ctaDefault)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (T) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: T.surfaceContainerLowest,
      borderRadius: LT_RADIUS.xl,
      padding: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: T.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      shadowColor: T.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    versionPill: {
      color: T.onSurfaceVariant,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      backgroundColor: T.surfaceContainer,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: LT_RADIUS.pill,
      marginBottom: 8,
    },
    title: {
      color: T.onSurface,
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: -0.4,
      marginBottom: 18,
    },
    bulletList: {
      maxHeight: 320,
      width: '100%',
      marginBottom: 16,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    bulletIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: T.surfaceContainer,
      borderWidth: 1,
      borderColor: T.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    bulletText: {
      flex: 1,
      color: T.onSurface,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: '500',
    },
    cta: {
      width: '100%',
      backgroundColor: T.primary,
      borderRadius: LT_RADIUS.lg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ctaText: {
      color: T.onPrimary,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
  });
