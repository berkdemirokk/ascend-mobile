import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { PATHS } from '../../data/paths';
import { LT } from '../../config/lightTheme';

export default function PickPathStep({ t, selectedPath, onSelect }) {
  return (
    <View style={styles.pickPathContent}>
      <Text style={styles.pickTitle}>
        {t('onboarding.pickPathTitle', 'Bugün hangi soruna saldırıyoruz?')}
      </Text>
      <Text style={styles.pickSubtitle}>
        {t('onboarding.pickPathSubtitle', 'Hepsini aynı anda değil. Şimdi en çok canını sıkanı seç.')}
      </Text>
      <ScrollView
        contentContainerStyle={styles.pathGrid}
        showsVerticalScrollIndicator={false}
      >
        {PATHS.map((p) => {
          const isSelected = selectedPath === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => onSelect(p.id)}
              activeOpacity={0.85}
              style={[
                styles.pathGridCard,
                {
                  borderColor: isSelected ? LT.primary : LT.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                  backgroundColor: LT.surfaceContainerLowest,
                  shadowColor: isSelected ? LT.primary : '#000',
                  shadowOpacity: isSelected ? 0.18 : 0.05,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: isSelected ? 6 : 2,
                },
              ]}
            >
              {isSelected && (
                <View style={styles.pathCheckBadge}>
                  <MaterialIcons name="check-circle" size={20} color={LT.primary} />
                </View>
              )}
              <View style={styles.pathGridIconBox}>
                <MaterialIcons name={p.materialIcon} size={32} color={isSelected ? LT.primary : LT.onSurfaceVariant} />
              </View>
              <Text style={styles.pathGridName}>
                {t(`paths.${p.id}.title`)}
              </Text>
              <Text style={styles.pathGridDuration}>
                {t('path.lessonsCount', { count: p.duration })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pickPathContent: { flex: 1, paddingTop: 40 },
  pickTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: LT.onSurface,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
    letterSpacing: 0,
  },
  pickSubtitle: {
    fontSize: 13,
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
    fontWeight: '500',
  },
  pathGrid: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  pathGridCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
  },
  pathCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  pathGridIconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pathGridName: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0,
  },
  pathGridDuration: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
