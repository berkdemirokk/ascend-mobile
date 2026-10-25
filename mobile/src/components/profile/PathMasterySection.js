import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { PATHS } from '../../data/paths';
import { LT, LT_SPACING } from '../../config/lightTheme';

export default function PathMasterySection({ pathProgress }) {
  const { t } = useTranslation();

  return (
    <View style={styles.pathMasterySection}>
      <Text style={styles.sectionTitle}>
        {t('profile.pathMasteryTitle', 'YOL USTALIĞI')}
      </Text>
      {PATHS.map((p) => {
        const completed = pathProgress?.[p.id]?.completed?.length || 0;
        const total = p.duration || 50;
        const pct = Math.min(100, Math.round((completed / total) * 100));
        return (
          <View key={p.id} style={styles.masteryRow}>
            <View style={styles.masteryHeader}>
              <MaterialIcons
                name={p.materialIcon}
                size={16}
                color={LT.onSurfaceVariant}
              />
              <Text style={styles.masteryName} numberOfLines={1}>
                {t(`paths.${p.id}.shortTitle`, p.title)}
              </Text>
              <Text style={styles.masteryPct}>{pct}%</Text>
            </View>
            <View style={styles.masteryTrack}>
              <View
                style={[
                  styles.masteryFill,
                  { width: `${pct}%` },
                  pct >= 100 ? styles.masteryFillDone : null,
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pathMasterySection: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 18,
    padding: 16,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
  },
  masteryRow: {
    marginTop: 12,
  },
  masteryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  masteryName: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  masteryPct: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
  masteryTrack: {
    height: 6,
    backgroundColor: LT.outlineVariant,
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    backgroundColor: LT.primary,
    borderRadius: 3,
  },
  masteryFillDone: {
    backgroundColor: LT.success || '#10B981',
  },
});
