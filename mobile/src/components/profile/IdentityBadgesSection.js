import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { LT, LT_RADIUS, LT_SPACING } from '../../config/lightTheme';

export default function IdentityBadgesSection({
  identityBadges = [],
  onSharePublicProfile,
}) {
  const { t } = useTranslation();

  if (!identityBadges || identityBadges.length === 0) return null;

  return (
    <View style={styles.badgesSection}>
      <View style={styles.badgesHeader}>
        <Text style={styles.sectionTitle}>
          {t('profile.identityTitle', 'KİMLİĞİN')}
        </Text>
        <TouchableOpacity
          onPress={onSharePublicProfile}
          activeOpacity={0.7}
          style={styles.publicShareBtn}
        >
          <MaterialIcons name="ios-share" size={14} color={LT.primary} />
          <Text style={styles.publicShareText}>
            {t('profile.publicShareCta', 'PROFİLİ PAYLAŞ')}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.badgesIntro}>
        {t(
          'profile.identitySub',
          'Bitirdiğin yollar seni şekillendiriyor. Sen artık şusun:',
        )}
      </Text>
      <View style={styles.badgesRow}>
        {identityBadges.map((b) => (
          <View key={b.id} style={styles.badgeChip}>
            <Text style={styles.badgeIcon}>{b.icon}</Text>
            <Text style={styles.badgeTitle}>{b.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgesSection: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 16,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 16,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
  },
  publicShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publicShareText: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  badgesIntro: {
    fontSize: 12,
    color: LT.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: LT.surfaceContainer,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.22)',
  },
  badgeIcon: { fontSize: 16 },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: LT.onSurface,
    letterSpacing: 0,
  },
});
