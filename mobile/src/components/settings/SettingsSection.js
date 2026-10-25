import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LT, LT_RADIUS } from '../../config/lightTheme';

export default function SettingsSection({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: LT.surfaceContainerLowest,
    marginHorizontal: 20,
    borderRadius: LT_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
});
