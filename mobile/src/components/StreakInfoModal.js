// StreakInfoModal — explains how the streak + freeze system works.
// Vivid Impact light theme.

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
} from 'react-native';
import {
  AccessibleTouchableOpacity as TouchableOpacity,
} from './AccessibleControls';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS } from '../config/lightTheme';

export default function StreakInfoModal({
  visible,
  onClose,
  streak,
  freezes,
  isPremium,
  onPaywall,
}) {
  const { t } = useTranslation();
  const safeStreak = Number.isFinite(streak) ? streak : 0;
  const safeFreezes = Number.isFinite(freezes) ? freezes : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.backdrop}
        accessible={false}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Kapat')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={20} color={LT.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <MaterialIcons
              name="local-fire-department"
              size={48}
              color={LT.primaryContainer}
            />
          </View>

          <Text style={styles.title}>
            {t('streak.infoTitle', 'Seri Sistemi')}
          </Text>

          <Text style={styles.streakBig}>
            <Text style={styles.streakNumber}>{safeStreak}</Text>
            <Text style={styles.streakUnit}>
              {' '}{t('streak.days', 'gün')}
            </Text>
          </Text>

          <Text style={styles.body}>
            {t(
              'streak.howWorks',
              'Her gün bir ders tamamlayarak serini koru. Bir gün atlarsan seri sıfırlanır.',
            )}
          </Text>

          {/* Freeze section */}
          <View style={styles.freezeBox}>
            <View style={styles.freezeRow}>
              <View style={styles.freezeIconBox}>
                <MaterialIcons name="ac-unit" size={20} color={LT.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.freezeTitle}>
                  {t('streak.freezeTitle', 'Seri Donduruculari')}
                </Text>
                <Text style={styles.freezeBody}>
                  {safeFreezes > 0
                    ? t(
                        'streak.freezeAvailable',
                        '{{count}} adet kullanılabilir. Bir gün atlarsan otomatik kullanılır.',
                        { count: safeFreezes },
                      )
                    : t(
                        'streak.freezeEmpty',
                        'Henüz dondurucu yok. Premium ile 3 dondurucu kazan.',
                      )}
                </Text>
              </View>
              <Text style={styles.freezeCount}>{safeFreezes}</Text>
            </View>
          </View>

          {!isPremium && safeFreezes === 0 ? (
            <TouchableOpacity
              onPress={() => {
                onClose?.();
                onPaywall?.();
              }}
              activeOpacity={0.9}
              style={styles.premiumBtn}
            >
              <MaterialIcons name="workspace-premium" size={18} color={LT.onPrimary} />
              <Text style={styles.premiumText}>
                {t('streak.getFreezes', 'PREMIUM İLE 3 DONDURUCU AL')}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={onClose} style={styles.gotItBtn}>
            <Text style={styles.gotItText}>
              {t('common.gotIt', 'ANLADIM')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
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
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 6,
  },
  streakBig: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
  },
  streakNumber: {
    color: LT.primaryContainer,
  },
  streakUnit: {
    color: LT.onSurfaceVariant,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  freezeBox: {
    width: '100%',
    backgroundColor: LT.surfaceContainerLow,
    borderColor: LT.outlineVariant,
    borderWidth: 1,
    borderRadius: LT_RADIUS.lg,
    padding: 14,
    marginBottom: 16,
  },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  freezeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(55, 65, 225, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(55, 65, 225, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeTitle: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  freezeBody: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  freezeCount: {
    color: LT.tertiary,
    fontSize: 24,
    fontWeight: '900',
    minWidth: 24,
    textAlign: 'center',
  },

  premiumBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: LT.primaryContainer,
    borderRadius: LT_RADIUS.lg,
    marginBottom: 6,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  premiumText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  gotItBtn: { paddingVertical: 10 },
  gotItText: {
    color: LT.outline,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
