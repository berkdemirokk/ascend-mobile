import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { LEVEL_THRESHOLDS } from '../../config/constants';
import { LT, LT_RADIUS, LT_SPACING } from '../../config/lightTheme';

export default function LevelProgressCard({
  level,
  xpInLevel,
  xpForNext,
  levelPercent,
  nextRank,
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.levelCard}>
      <View style={styles.levelHeader}>
        <View>
          <Text style={styles.levelLabel}>
            {t('profile.level', 'SEVİYE')} {level}
          </Text>
          <Text style={styles.levelTitle}>
            {t(
              `level.${level}`,
              LEVEL_THRESHOLDS.find((tier) => tier.level === level)
                ?.title || 'Beginner',
            )}
          </Text>
        </View>
        <Text style={styles.levelXP}>
          <Text style={styles.levelXPNum}>{xpInLevel}</Text>
          <Text style={styles.levelXPMax}> / {xpForNext} XP</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${levelPercent}%` }]}
        />
      </View>
      {nextRank ? (
        <View style={styles.nextRankPill}>
          <MaterialIcons
            name="trending-up"
            size={12}
            color={LT.primaryContainer}
          />
          <Text style={styles.nextRankText}>
            {t('profile.nextRank', 'SONRAKİ RÜTBE')}:{' '}
            <Text style={styles.nextRankValue}>
              {t(`ranks.${nextRank.id}.title`, nextRank.title)}
            </Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  levelCard: {
    marginHorizontal: LT_SPACING.containerMargin,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 18,
    marginBottom: 14,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    color: LT.onSurface,
    marginTop: 2,
  },
  levelXP: {
    textAlign: 'right',
  },
  levelXPNum: {
    fontSize: 18,
    fontWeight: '900',
    color: LT.primaryContainer,
    letterSpacing: 0,
  },
  levelXPMax: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.outline,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: LT.surfaceContainer,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: LT.primaryContainer,
    borderRadius: 4,
  },
  nextRankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: 'rgba(227, 18, 18, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
  },
  nextRankText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: LT.onSurfaceVariant,
  },
  nextRankValue: {
    color: LT.primaryContainer,
    fontWeight: '900',
  },
});
