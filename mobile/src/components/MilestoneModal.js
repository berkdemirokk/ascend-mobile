import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import ConfettiBurst from './ConfettiBurst';
import { hapticMilestone } from '../services/haptics';

const MILESTONES = {
  3: { emoji: '🔥', title: '3 Days!', subtitle: 'The flame is lit' },
  7: { emoji: '💎', title: '1 Week!', subtitle: 'One week complete' },
  14: { emoji: '⚡', title: '2 Weeks!', subtitle: 'New rhythm forming' },
  21: { emoji: '🛡️', title: '3 Weeks!', subtitle: 'Discipline is becoming stable' },
  30: { emoji: '👑', title: '30 Days!', subtitle: 'New routine, new direction' },
  60: { emoji: '⚔️', title: '60 Days!', subtitle: 'Respect is earned' },
  100: { emoji: '🏆', title: '100 Days!', subtitle: 'Mastery is visible' },
  365: { emoji: '🐉', title: '1 Year!', subtitle: 'One year complete' },
};

export const isMilestone = (streak) => Object.keys(MILESTONES).includes(String(streak));

export const getMilestone = (streak) => MILESTONES[streak] || null;

export default function MilestoneModal({ visible, streak, onClose }) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0)).current;
  const milestone = getMilestone(streak);

  useEffect(() => {
    if (visible && milestone) {
      // hapticMilestone is a composed 3-thump pattern (boom-boom-success)
      // that makes the milestone feel like a real event, not just a toast.
      hapticMilestone();
      Animated.spring(scale, {
        toValue: 1,
        damping: 8,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
    } else {
      scale.setValue(0);
    }
  }, [visible, milestone, scale]);

  if (!milestone) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Confetti fires once per `visible` toggle; trigger key changes
            with the streak number so each milestone gets a fresh burst. */}
        {visible ? <ConfettiBurst trigger={streak} /> : null}
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <LinearGradient
            colors={['#F59E0B', '#EF4444', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Text style={styles.emoji}>{milestone.emoji}</Text>
            <Text style={styles.title}>
              {t(`milestone.${streak}.title`, milestone.title)}
            </Text>
            <Text style={styles.subtitle}>
              {t(`milestone.${streak}.subtitle`, milestone.subtitle)}
            </Text>
            <Text style={styles.streakNumber}>
              {streak} {t('common.days').toLowerCase()}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>
                {t('common.continue')} 🔥
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 11, 20, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { borderRadius: 28, overflow: 'hidden', width: '100%', maxWidth: 360 },
  gradient: { padding: 32, alignItems: 'center' },
  emoji: { fontSize: 120, marginBottom: 16 },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 16,
    fontWeight: '600',
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FDE047',
    marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  closeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
