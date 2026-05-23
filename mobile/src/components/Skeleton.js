// Skeleton — shimmer placeholder used during the brief window between
// AppContext mount and AsyncStorage hydration (state._loaded === false).
//
// Without this, a user with progress sees their actual numbers flicker
// in over the default-zero render: streak 0 → 47, level 1 → 12, etc.
// On slow Android storage this can be a visible jump that reads as
// "broken" to anyone watching closely. Skeletons mask the gap with a
// designed surface and make the reveal feel intentional.
//
// API:
//   <Skeleton width={120} height={20} />
//   <Skeleton width="60%" height={24} borderRadius={12} />
//
// Higher-level compositions (SkeletonHome, SkeletonPath, etc.) live in
// their own files near the screens that use them.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { useDynamicLT } from '../config/theme';

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 6,
  style,
}) {
  const T = useDynamicLT();
  const opacity = useRef(new Animated.Value(0.4)).current;

  // Soft pulse between 0.4 and 0.85 opacity. 900ms half-cycle is the
  // sweet spot — fast enough to feel alive, slow enough not to read
  // as urgent / loading-failed. Matches iOS native skeleton cadence.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: T.surfaceContainerHigh,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
