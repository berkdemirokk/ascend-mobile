import { View, StyleSheet } from 'react-native';
import { LT, LT_RADII } from '../../config/lightTheme';

export function HabitChain({ chainDays }) {
  if (!chainDays || !chainDays.length) return null;

  return (
    <View style={styles.chainRow}>
      {chainDays.map((d) => (
        <View
          key={d.key}
          style={[
            styles.chainDot,
            d.active && styles.chainDotActive,
            d.isToday && styles.chainDotToday,
            d.isToday && d.active && styles.chainDotTodayActive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chainRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 14,
    paddingHorizontal: 20,
  },
  chainDot: {
    width: 14,
    height: 14,
    borderRadius: LT_RADII.pill,
    backgroundColor: LT.surfaceContainerHigh,
  },
  chainDotActive: {
    backgroundColor: LT.primaryContainer,
  },
  chainDotToday: {
    borderWidth: 2,
    borderColor: LT.primary,
  },
  chainDotTodayActive: {
    backgroundColor: LT.primary,
    borderColor: LT.primary,
  },
});
