// Daily Mystery Box — variable-reward mechanic for retention. User can
// open the box once per calendar day to earn a random reward (XP, streak
// freeze, or hint coin). Variable rewards are the most addictive
// reinforcement pattern in behavioral psychology (B.F. Skinner; modern
// casino/social-media app loops). Per Nir Eyal's Hooked model, this is
// the "variable reward" stage that pulls users back daily.
//
// Once opened, the box is locked until midnight local time. The card
// stays on Home with the reward visible until the next day so the user
// remembers what they got (positive reinforcement → return tomorrow).

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { hapticImpactMedium, hapticMilestone } from '../services/haptics';
import { playSound } from '../services/sounds';
import ConfettiBurst from './ConfettiBurst';

// Reward pool. Probabilities are tuned so the average XP value per day
// is ~25 — meaningful but not enough to break the lesson XP economy.
// Higher-rarity entries have lower probability + bigger payouts.
const REWARDS = [
  { id: 'xp_10', kind: 'xp', value: 10, weight: 35, icon: '⭐', rarity: 'common' },
  { id: 'xp_25', kind: 'xp', value: 25, weight: 25, icon: '✨', rarity: 'common' },
  { id: 'xp_50', kind: 'xp', value: 50, weight: 15, icon: '💫', rarity: 'rare' },
  { id: 'xp_100', kind: 'xp', value: 100, weight: 5, icon: '🌟', rarity: 'epic' },
  { id: 'freeze_1', kind: 'freeze', value: 1, weight: 12, icon: '❄️', rarity: 'rare' },
  { id: 'streak_protect', kind: 'streak_bonus', value: 1, weight: 8, icon: '🛡️', rarity: 'epic' },
];

/** Weighted pick from REWARDS. Deterministic per-day via seed so the
 *  user can't cheese it by reopening — once awarded, the result is
 *  locked in `dailyMysteryBoxLastReward` until the next day. */
const pickReward = () => {
  const totalWeight = REWARDS.reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * totalWeight;
  for (const r of REWARDS) {
    n -= r.weight;
    if (n <= 0) return r;
  }
  return REWARDS[0];
};

export default function DailyMysteryBox({
  alreadyOpenedToday,
  lastReward,
  onOpen,
}) {
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);
  const [revealedReward, setRevealedReward] = useState(null);
  const scale = useRef(new Animated.Value(1)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  // Render the lasting "you opened the box today" state. The card sticks
  // around so the user remembers what they got — positive reinforcement
  // for tomorrow's open.
  const displayReward = useMemo(() => {
    if (revealedReward) return revealedReward;
    if (alreadyOpenedToday && lastReward) {
      return REWARDS.find((r) => r.id === lastReward) || null;
    }
    return null;
  }, [alreadyOpenedToday, lastReward, revealedReward]);

  const handleOpen = async () => {
    if (opening || alreadyOpenedToday) return;
    setOpening(true);
    hapticImpactMedium();
    // Wobble animation before opening — builds anticipation, makes the
    // reveal feel earned.
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(wobble, { toValue: -1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(wobble, { toValue: 1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(wobble, { toValue: 0, duration: 80, useNativeDriver: true, easing: Easing.linear }),
    ]).start();

    setTimeout(() => {
      const reward = pickReward();
      setRevealedReward(reward);
      hapticMilestone();
      playSound('milestone').catch(() => {});
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.2, useNativeDriver: true, friction: 4 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
      ]).start();
      onOpen?.(reward);
      setOpening(false);
    }, 380);
  };

  const rotate = wobble.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-8deg', '8deg'],
  });

  // ─── Render: claimed state ─────────────────────────────────────────
  if (displayReward) {
    return (
      <View style={[styles.card, styles.cardClaimed]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {revealedReward ? <ConfettiBurst trigger={revealedReward.id} compact /> : null}
        </View>
        <View style={styles.iconWrap}>
          <Text style={styles.boxIcon}>{displayReward.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {t('mysteryBox.todayReward', "TODAY'S MYSTERY BONUS")}
          </Text>
          <Text style={styles.title}>
            {displayReward.kind === 'xp' && `+${displayReward.value} XP`}
            {displayReward.kind === 'freeze' && t('mysteryBox.gotFreeze', '+1 Streak Freeze')}
            {displayReward.kind === 'streak_bonus' && t('mysteryBox.gotProtect', '+1 Streak Protect')}
          </Text>
          <Text style={styles.subtitle}>
            {t('mysteryBox.comeBackTomorrow', 'Come back tomorrow for another reward.')}
          </Text>
        </View>
      </View>
    );
  }

  // ─── Render: unopened state ────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={handleOpen}
      activeOpacity={0.85}
      disabled={opening}
      style={styles.card}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          { transform: [{ scale }, { rotate }] },
        ]}
      >
        <Text style={styles.boxIcon}>🎁</Text>
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>
          {t('mysteryBox.label', 'DAILY MYSTERY BOX')}
        </Text>
        <Text style={styles.title}>
          {t('mysteryBox.openCta', 'Tap to open')}
        </Text>
        <Text style={styles.subtitle}>
          {t('mysteryBox.hint', 'XP, streak freeze, or rare bonus inside.')}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={26} color={LT.onSurfaceVariant} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    overflow: 'hidden',
  },
  cardClaimed: {
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLow,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxIcon: { fontSize: 32 },
  eyebrow: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    color: LT.onSurface,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
  },
});
