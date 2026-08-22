import React from 'react';
import {
  Pressable as NativePressable,
  TouchableOpacity as NativeTouchableOpacity,
} from 'react-native';

export const resolveAccessibilityProps = ({
  onPress,
  disabled,
  accessible,
  accessibilityRole,
  accessibilityState,
}) => ({
  accessible,
  accessibilityRole: accessibilityRole ?? (onPress && accessible !== false ? 'button' : undefined),
  accessibilityState: disabled
    ? { ...(accessibilityState || {}), disabled: true }
    : accessibilityState,
});

export function AccessibleTouchableOpacity({
  onPress,
  disabled,
  accessible,
  accessibilityRole,
  accessibilityState,
  ...props
}) {
  return (
    <NativeTouchableOpacity
      {...props}
      {...resolveAccessibilityProps({
        onPress,
        disabled,
        accessible,
        accessibilityRole,
        accessibilityState,
      })}
      onPress={onPress}
      disabled={disabled}
    />
  );
}

export function AccessiblePressable({
  onPress,
  disabled,
  accessible,
  accessibilityRole,
  accessibilityState,
  ...props
}) {
  return (
    <NativePressable
      {...props}
      {...resolveAccessibilityProps({
        onPress,
        disabled,
        accessible,
        accessibilityRole,
        accessibilityState,
      })}
      onPress={onPress}
      disabled={disabled}
    />
  );
}
