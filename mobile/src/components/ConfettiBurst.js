// Lightweight confetti effect — 18 colored particles that fire upward+
// outward from the centerpoint with rotation and gravity-style fall.
// Pure React Native Animated (no third-party deps). Runs natively via
// useNativeDriver: true, so it's smooth even on older devices.
//
// Designed to overlay an existing UI as an "explode" effect — pair it
// with milestone modals, level-up screens, lesson completions.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const COLORS = [
  '#FDE047', // yellow
  '#F97316', // orange
  '#EF4444', // red
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#3B82F6', // blue
  '#10B981', // emerald
];

const NUM_PARTICLES = 22;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * <ConfettiBurst trigger={someChangingValue} />
 *
 * Replays every time `trigger` changes value. Pass the milestone streak
 * number, a boolean toggle, anything — just must mutate to re-fire.
 *
 * Pass `compact` to keep the burst within a 280×400 box (for inside
 * cards/modals). Otherwise the particles spread the full screen.
 */
export default function ConfettiBurst({ trigger, compact = false }) {
  // useMemo so particle "seeds" stay stable across re-renders within a
  // single burst — we only re-randomize when `trigger` changes.
  const particles = useMemo(() => {
    return Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      id: `${trigger}-${i}`,
      color: COLORS[i % COLORS.length],
      // Random offset in [-1, 1] determines horizontal spread direction.
      hOffset: (Math.random() - 0.5) * 2,
      // Initial upward velocity → translated into peak Y.
      peakY: -160 - Math.random() * 80,
      // Final resting Y (gravity pulls them down past start).
      endY: (compact ? 200 : SCREEN_H * 0.45) + Math.random() * 60,
      delay: Math.random() * 120,
      duration: 1100 + Math.random() * 600,
      size: 6 + Math.floor(Math.random() * 6),
      rotateSeed: Math.random() * 720,
      anim: new Animated.Value(0),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useEffect(() => {
    if (!trigger) return undefined;
    // Re-run every particle from 0 → 1.
    const animations = particles.map((p) =>
      Animated.timing(p.anim, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    Animated.parallel(animations).start();
    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [trigger, particles]);

  if (!trigger) return null;

  const spread = compact ? 140 : SCREEN_W * 0.5;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => {
        // Two-stage Y: 0→0.4 rise to peakY, 0.4→1 fall to endY. Done with
        // interpolate ranges so it's one continuous native animation.
        const translateY = p.anim.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, p.peakY, p.endY],
        });
        const translateX = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.hOffset * spread],
        });
        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotateSeed}deg`],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.1, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size * 1.5,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    marginLeft: -4,
    marginTop: -8,
    borderRadius: 2,
  },
});
