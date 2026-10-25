import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { LT, LT_RADIUS } from '../../config/lightTheme';

export default function ProfileStatCard({ icon, iconColor, label, value, unit, accent }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <View style={styles.statCardHeader}>
        <MaterialIcons
          name={icon}
          size={16}
          color={iconColor || LT.onSurfaceVariant}
        />
        <Text style={styles.statCardLabel}>{label}</Text>
      </View>
      <View style={styles.statCardBody}>
        <Text style={[styles.statCardValue, accent && styles.statCardValueAccent]}>
          {value}
        </Text>
        {unit ? <Text style={styles.statCardUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    width: '48%',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 14,
  },
  statCardAccent: {
    borderColor: 'rgba(227, 18, 18, 0.4)',
    backgroundColor: 'rgba(227, 18, 18, 0.04)',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
  },
  statCardBody: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statCardValue: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    color: LT.onSurface,
  },
  statCardValueAccent: {
    color: LT.primaryContainer,
  },
  statCardUnit: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: LT.outline,
    textTransform: 'uppercase',
  },
});
