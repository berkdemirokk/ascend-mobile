import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { ARCHETYPES } from '../../data/archetypes';
import { LT } from '../../config/lightTheme';

export default function ArchetypeStep({ t, selectedArchetype, onSelect }) {
  return (
    <View style={styles.archetypeContent}>
      <Text style={styles.pickTitle}>
        {t(
          'onboarding.archetypeTitle',
          '30 gün sonra neyin değişmiş olsun?',
        )}
      </Text>
      <Text style={styles.pickSubtitle}>
        {t(
          'onboarding.archetypeSubtitle',
          'Tek bir yön seç. Planın her gün o yönde küçük bir kanıt üretsin.',
        )}
      </Text>
      <ScrollView
        contentContainerStyle={styles.archetypeList}
        showsVerticalScrollIndicator={false}
      >
        {ARCHETYPES.map((a) => {
          const isSelected = selectedArchetype === a.id;
          return (
            <TouchableOpacity
              key={a.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              accessibilityLabel={`${t(a.nameKey, a.nameFallback)}, ${t(a.tagKey, a.tagFallback)}, ${t(a.descKey, a.descFallback)}`}
              onPress={() => onSelect(a.id)}
              activeOpacity={0.85}
              style={[
                styles.archetypeCard,
                {
                  borderColor: isSelected ? a.accent : LT.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                  shadowOpacity: isSelected ? 0.15 : 0.04,
                },
              ]}
            >
              <View
                style={[
                  styles.archetypeIconBox,
                  { backgroundColor: isSelected ? a.accent : LT.surfaceContainer },
                ]}
              >
                <MaterialIcons
                  name={a.icon}
                  size={28}
                  color={isSelected ? '#fff' : LT.onSurfaceVariant}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.archetypeName}>
                  {t(a.nameKey, a.nameFallback)}
                </Text>
                <Text style={styles.archetypeTag}>
                  {t(a.tagKey, a.tagFallback)}
                </Text>
                <Text style={styles.archetypeDesc}>
                  {t(a.descKey, a.descFallback)}
                </Text>
              </View>
              {isSelected ? (
                <MaterialIcons
                  name="check-circle"
                  size={22}
                  color={a.accent}
                  style={styles.archetypeCheck}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  archetypeContent: { flex: 1, paddingTop: 40 },
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
  archetypeList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  archetypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  archetypeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archetypeName: {
    fontSize: 16,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 2,
  },
  archetypeTag: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.primary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  archetypeDesc: {
    fontSize: 12,
    color: LT.onSurfaceVariant,
    lineHeight: 16,
  },
  archetypeCheck: {
    marginLeft: 4,
  },
});
