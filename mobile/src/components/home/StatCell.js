import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { LT, LT_RADII, LT_SHADOW } from '../../config/lightTheme';

export function StatCell({ icon, label, value, sub }) {
  return (
    <View style={styles.statCell}>
      <MaterialIcons name={icon} size={16} color={LT.onSurfaceVariant} />
      <Text style={styles.statValue}>
        {value}
        {sub ? <Text style={styles.statValueSub}> {sub}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statCell: {
    flex: 1,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...LT_SHADOW.ambient,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: LT.onSurface,
    marginTop: 4,
    marginBottom: 2,
  },
  statValueSub: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
    textAlign: 'center',
  },
});
