import { Text, StyleSheet, View } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { LT, LT_RADII, LT_SHADOW } from '../../config/lightTheme';

export function LinkRow({ icon, label, sub, onPress }) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.linkIconWrap}>
        <MaterialIcons name={icon} size={20} color={LT.primaryContainer} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkSub}>{sub}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={LT.outline} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.lg,
    padding: 14,
    marginBottom: 8,
    ...LT_SHADOW.ambient,
  },
  linkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: LT_RADII.sm,
    backgroundColor: LT.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: LT.onSurface,
    marginBottom: 2,
  },
  linkSub: {
    fontSize: 12,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
  },
});
