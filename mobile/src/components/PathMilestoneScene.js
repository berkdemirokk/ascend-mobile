// PathMilestoneScene — full-screen "you reached a chapter in the
// journey" modal that fires every 10 lessons WITHIN a single path.
// Unlike the existing MilestoneModal (which celebrates day-streak
// numbers globally), this is path-specific narrative: as the user
// climbs through Dopamine Detox lesson 1 → 50, they get 5 scene
// breaks (10, 20, 30, 40, 50) marking the journey.
//
// Why: the user said the app "didn't captivate me". Story arcs are
// the single most-effective long-term-retention mechanic in any
// content app. RPG-style "chapter complete" beats give the user a
// reason to wonder what's next. Pure narrative scaffolding on
// existing content — no new lessons needed.

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
import { playSound } from '../services/sounds';

// Scenes per path: keyed `${pathId}-${stage}` where stage ∈ {10,20,30,40,50}.
// Each scene has an emoji + i18n key for the localized title/body.
const SCENES = {
  // -- Dopamine Detox --
  'dopamine-detox-10': { emoji: '🏔️', titleKey: 'pathScene.dd10.title', bodyKey: 'pathScene.dd10.body' },
  'dopamine-detox-20': { emoji: '🌫️', titleKey: 'pathScene.dd20.title', bodyKey: 'pathScene.dd20.body' },
  'dopamine-detox-30': { emoji: '⚒️', titleKey: 'pathScene.dd30.title', bodyKey: 'pathScene.dd30.body' },
  'dopamine-detox-40': { emoji: '🦁', titleKey: 'pathScene.dd40.title', bodyKey: 'pathScene.dd40.body' },
  'dopamine-detox-50': { emoji: '👑', titleKey: 'pathScene.dd50.title', bodyKey: 'pathScene.dd50.body' },

  // -- Silent Morning --
  'silent-morning-10': { emoji: '🌅', titleKey: 'pathScene.sm10.title', bodyKey: 'pathScene.sm10.body' },
  'silent-morning-20': { emoji: '☕', titleKey: 'pathScene.sm20.title', bodyKey: 'pathScene.sm20.body' },
  'silent-morning-30': { emoji: '🌄', titleKey: 'pathScene.sm30.title', bodyKey: 'pathScene.sm30.body' },
  'silent-morning-40': { emoji: '🔥', titleKey: 'pathScene.sm40.title', bodyKey: 'pathScene.sm40.body' },
  'silent-morning-50': { emoji: '🌞', titleKey: 'pathScene.sm50.title', bodyKey: 'pathScene.sm50.body' },

  // -- Mind Discipline --
  'mind-discipline-10': { emoji: '🧠', titleKey: 'pathScene.md10.title', bodyKey: 'pathScene.md10.body' },
  'mind-discipline-20': { emoji: '🎯', titleKey: 'pathScene.md20.title', bodyKey: 'pathScene.md20.body' },
  'mind-discipline-30': { emoji: '⚡', titleKey: 'pathScene.md30.title', bodyKey: 'pathScene.md30.body' },
  'mind-discipline-40': { emoji: '🗡️', titleKey: 'pathScene.md40.title', bodyKey: 'pathScene.md40.body' },
  'mind-discipline-50': { emoji: '🧘', titleKey: 'pathScene.md50.title', bodyKey: 'pathScene.md50.body' },

  // -- Body Discipline --
  'body-discipline-10': { emoji: '🏃', titleKey: 'pathScene.bd10.title', bodyKey: 'pathScene.bd10.body' },
  'body-discipline-20': { emoji: '💪', titleKey: 'pathScene.bd20.title', bodyKey: 'pathScene.bd20.body' },
  'body-discipline-30': { emoji: '🧗', titleKey: 'pathScene.bd30.title', bodyKey: 'pathScene.bd30.body' },
  'body-discipline-40': { emoji: '🛡️', titleKey: 'pathScene.bd40.title', bodyKey: 'pathScene.bd40.body' },
  'body-discipline-50': { emoji: '🦅', titleKey: 'pathScene.bd50.title', bodyKey: 'pathScene.bd50.body' },

  // -- Money Discipline --
  'money-discipline-10': { emoji: '🌱', titleKey: 'pathScene.mn10.title', bodyKey: 'pathScene.mn10.body' },
  'money-discipline-20': { emoji: '🌳', titleKey: 'pathScene.mn20.title', bodyKey: 'pathScene.mn20.body' },
  'money-discipline-30': { emoji: '🏛️', titleKey: 'pathScene.mn30.title', bodyKey: 'pathScene.mn30.body' },
  'money-discipline-40': { emoji: '⚖️', titleKey: 'pathScene.mn40.title', bodyKey: 'pathScene.mn40.body' },
  'money-discipline-50': { emoji: '💎', titleKey: 'pathScene.mn50.title', bodyKey: 'pathScene.mn50.body' },
};

/** Returns the scene config for a path+stage combo, or null. */
export const getPathScene = (pathId, stage) => {
  if (!pathId || ![10, 20, 30, 40, 50].includes(stage)) return null;
  return SCENES[`${pathId}-${stage}`] || null;
};

/**
 * Detect whether finishing a lesson just crossed a path-internal
 * milestone (10/20/30/40/50). Takes the path's completed-count
 * AFTER this completion is applied.
 *
 * @param {number} completedAfter  e.g. 10, 11, 20, 25
 * @returns {number|null}  the milestone stage hit (10/20/30/40/50) or null
 */
export const detectPathSceneStage = (completedAfter) => {
  if (!completedAfter) return null;
  if ([10, 20, 30, 40, 50].includes(completedAfter)) return completedAfter;
  return null;
};

export default function PathMilestoneScene({
  visible,
  pathId,
  stage,
  onClose,
  onStartNextPath, // optional: only meaningful when stage === 50
  nextPathName,    // optional: display name for the next path CTA
}) {
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0)).current;
  const scene = getPathScene(pathId, stage);

  useEffect(() => {
    if (visible && scene) {
      hapticMilestone();
      playSound('milestone').catch(() => {});
      Animated.spring(scale, {
        toValue: 1,
        damping: 9,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      scale.setValue(0);
    }
  }, [visible, scene, scale]);

  if (!scene) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {visible ? <ConfettiBurst trigger={`${pathId}-${stage}`} /> : null}
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <LinearGradient
            colors={['#1E1B4B', '#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Text style={styles.eyebrow}>
              {t('pathScene.chapter', 'CHAPTER {{stage}}/50', { stage })}
            </Text>
            <Text style={styles.emoji}>{scene.emoji}</Text>
            <Text style={styles.title}>{t(scene.titleKey)}</Text>
            <Text style={styles.body}>{t(scene.bodyKey)}</Text>
            {/* Stage 50 (path-complete) special-cases the CTA to nudge
                into the NEXT path. Path-completers are the highest-LTV
                cohort about to churn because they've "finished" — the
                one-tap-to-next-path CTA is the cheapest re-engagement
                lever for them. Other stages keep the original "Continue
                the journey" close button. */}
            {stage === 50 && onStartNextPath ? (
              <>
                <TouchableOpacity
                  onPress={onStartNextPath}
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {nextPathName
                      ? t(
                          'pathScene.nextPathCta',
                          'Sıradaki yol: {{name}} →',
                          { name: nextPathName },
                        )
                      : t('pathScene.nextPathCtaGeneric', 'Sıradaki yola başla →')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeBtnText}>
                    {t('pathScene.laterCta', 'Sonra')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.85}>
                <Text style={styles.closeBtnText}>
                  {t('pathScene.continueCta', 'Continue the journey →')}
                </Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 24, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 380,
  },
  gradient: {
    padding: 28,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 14,
  },
  emoji: { fontSize: 96, marginBottom: 18 },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  body: {
    color: '#FFFFFF',
    opacity: 0.92,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
    paddingHorizontal: 8,
    fontStyle: 'italic',
  },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  // Path-50 primary CTA — gold contrast against the indigo/purple
  // gradient so it visually claims "this is the next move."
  primaryBtn: {
    backgroundColor: '#FDE047',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#1E1B4B',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
