// AchievementDetailModal — shown when user taps an achievement card.
// Displays icon, title, description, rarity badge, and unlock state.

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ACHIEVEMENTS, RARITY_COLORS, isPremiumGated } from '../config/achievements';
import { useApp } from '../contexts/AppContext';
import { LT, LT_RADIUS } from '../config/lightTheme';

const RARITY_LABEL_KEY = {
  common: 'achievements.rarity.common',
  uncommon: 'achievements.rarity.uncommon',
  rare: 'achievements.rarity.rare',
  epic: 'achievements.rarity.epic',
  legendary: 'achievements.rarity.legendary',
};

const RARITY_LABEL_FALLBACK = {
  common: 'YAYGIN',
  uncommon: 'NADİR',
  rare: 'ENDER',
  epic: 'EPİK',
  legendary: 'EFSANE',
};

export default function AchievementDetailModal({
  visible,
  onClose,
  achievementId,
  unlocked,
  onUpgrade,
}) {
  const { t } = useTranslation();
  const {
    isPremium,
    totalLessonsCompleted,
    currentStreak,
    level,
  } = useApp();
  if (!achievementId) return null;
  const ach = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!ach) return null;

  const rarityColor = RARITY_COLORS[ach.rarity] || '#9CA3AF';
  const rarityLabel = t(
    RARITY_LABEL_KEY[ach.rarity],
    RARITY_LABEL_FALLBACK[ach.rarity] || 'YAYGIN',
  );

  // Premium-locked state — user already met the target but the badge is
  // gated. We show progress + "Premium ile aç" instead of generic locked.
  const premiumGated = isPremiumGated(ach, {
    isPremium,
    totalLessonsCompleted,
    streak: currentStreak,
    level,
  });

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
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color={LT.onSurfaceVariant} />
          </TouchableOpacity>

          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: unlocked ? `${rarityColor}1F` : LT.surfaceContainer,
                borderColor: unlocked ? rarityColor : LT.outlineVariant,
              },
            ]}
          >
            <Text style={[styles.iconEmoji, !unlocked && { opacity: 0.3 }]}>
              {unlocked ? ach.icon : '🔒'}
            </Text>
          </View>

          <View
            style={[
              styles.rarityBadge,
              {
                backgroundColor: `${rarityColor}22`,
                borderColor: `${rarityColor}66`,
              },
            ]}
          >
            <Text style={[styles.rarityText, { color: rarityColor }]}>
              {rarityLabel}
            </Text>
          </View>

          <Text style={[styles.title, !unlocked && { opacity: 0.5 }]}>
            {t(`ach.${ach.id}.title`, ach.title)}
          </Text>
          <Text style={styles.description}>
            {t(`ach.${ach.id}.description`, ach.description)}
          </Text>

          {unlocked ? (
            <View style={styles.unlockedRow}>
              <MaterialIcons
                name="check-circle"
                size={18}
                color={LT.primaryContainer}
              />
              <Text style={styles.unlockedText}>
                {t('achievements.unlocked', 'AÇILDI')}
              </Text>
            </View>
          ) : premiumGated ? (
            <View style={styles.premiumGatedRow}>
              <MaterialIcons name="workspace-premium" size={16} color={LT.primary} />
              <Text style={styles.premiumGatedText}>
                {t(
                  'achievements.premiumGated',
                  'Hedefe ulaştın — Premium ile aç',
                )}
              </Text>
            </View>
          ) : (
            <View style={styles.lockedRow}>
              <MaterialIcons name="lock" size={16} color={LT.outline} />
              <Text style={styles.lockedText}>
                {t('achievements.locked', 'Henüz açılmadı')}
              </Text>
            </View>
          )}

          {premiumGated ? (
            <TouchableOpacity
              onPress={() => {
                onClose?.();
                onUpgrade?.();
              }}
              style={styles.upgradeBtn}
              activeOpacity={0.85}
            >
              <MaterialIcons name="auto-awesome" size={16} color={LT.onPrimary} />
              <Text style={styles.upgradeText}>
                {t('achievements.upgradeCta', "PREMIUM'A GEÇ")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onClose} style={styles.gotItBtn}>
              <Text style={styles.gotItText}>
                {t('common.close', 'Kapat')}
              </Text>
            </TouchableOpacity>
          )}
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
    maxWidth: 340,
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  iconEmoji: { fontSize: 44 },
  rarityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LT_RADIUS.pill,
    borderWidth: 1,
    marginBottom: 12,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    color: LT.onSurface,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
    marginBottom: 14,
  },
  unlockedText: {
    color: LT.primaryContainer,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  lockedText: {
    color: LT.outline,
    fontSize: 12,
    fontWeight: '700',
  },
  premiumGatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.22)',
    marginBottom: 14,
  },
  premiumGatedText: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: LT.primary,
    borderRadius: LT_RADIUS.lg,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 4,
  },
  upgradeText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  gotItBtn: { paddingVertical: 8 },
  gotItText: {
    color: LT.outline,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
