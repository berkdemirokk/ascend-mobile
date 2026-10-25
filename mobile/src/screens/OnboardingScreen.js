import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  StyleSheet,
  StatusBar,
} from 'react-native';
import {
  AccessibleTouchableOpacity as TouchableOpacity,
} from '../components/AccessibleControls';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { useApp } from '../contexts/AppContext';
import { LT } from '../config/lightTheme';
import { DEFAULT_ARCHETYPE_ID, getArchetypeById } from '../data/archetypes';
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  scheduleWeeklyRecap,
  scheduleFirstWeekHooks,
} from '../services/notifications';
import {
  requestTrackingPermissionIfNeeded,
  initAds,
  loadInterstitial,
  loadRewarded,
} from '../services/ads';
import { track } from '../services/analytics';
import { useAuth } from '../contexts/AuthContext';

// Modularized onboarding step subcomponents
import PersonalizeStep from '../components/onboarding/PersonalizeStep';
import PickPathStep from '../components/onboarding/PickPathStep';
import ArchetypeStep from '../components/onboarding/ArchetypeStep';
import UpsellStep from '../components/onboarding/UpsellStep';

const STEPS = ['personalize', 'pickPath', 'archetype', 'upsell'];

const GOAL_TO_PATH = {
  focus: 'mind-discipline',
  morning: 'silent-morning',
  fitness: 'body-discipline',
  money: 'money-discipline',
  discipline: 'dopamine-detox',
};

export default function OnboardingScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    completeOnboarding,
    setUserProfile,
    setActivePath,
    isPremium,
  } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState('personalize');
  const [selectedPath, setSelectedPath] = useState('dopamine-detox');
  const [selectedArchetype, setSelectedArchetype] = useState(
    DEFAULT_ARCHETYPE_ID,
  );
  const [answers, setAnswers] = useState({
    name: '',
    goal: null,
    time: null,
    mood: null,
  });
  const stepIndex = Math.max(0, STEPS.indexOf(step));

  useEffect(() => {
    track({
      event: 'onboarding_step_viewed',
      userId: user?.id,
      props: {
        step,
        stepIndex: STEPS.indexOf(step),
      },
    });
  }, [step, user?.id]);

  useEffect(() => {
    const announcement = t('onboarding.stepProgress', {
      current: stepIndex + 1,
      total: STEPS.length,
      defaultValue: `Step ${stepIndex + 1} of ${STEPS.length}`,
    });
    try {
      AccessibilityInfo.announceForAccessibility?.(announcement);
    } catch {}
  }, [stepIndex, t]);

  const finishOnboarding = () => {
    setUserProfile({
      name: (answers.name || '').trim() || null,
      goals: answers.goal ? [answers.goal] : ['discipline'],
      archetype: selectedArchetype,
      answers,
    });
    setActivePath(selectedPath);

    track({
      event: 'onboarding_completed',
      userId: user?.id,
      props: {
        path: selectedPath,
        archetype: selectedArchetype,
        goal: answers.goal,
        time: answers.time,
        mood: answers.mood,
        isPremium: !!isPremium,
      },
    });

    const firstLesson = `${selectedPath}-1`;
    try {
      navigation?.navigate?.('Lesson', {
        pathId: selectedPath,
        lessonId: firstLesson,
      });
    } catch {}
    completeOnboarding();

    (async () => {
      try {
        const granted = await requestNotificationPermissions();
        if (granted) {
          scheduleDailyReminder({
            currentStreak: 0,
            userName: answers.name || '',
            archetypeName: t(
              getArchetypeById(selectedArchetype).nameKey,
              getArchetypeById(selectedArchetype).nameFallback,
            ),
            activePathId: selectedPath,
          }).catch(() => {});
          scheduleWeeklyRecap().catch(() => {});
          scheduleFirstWeekHooks({ userName: answers.name || '' }).catch(
            () => {},
          );
        }
      } catch {}
      try {
        await requestTrackingPermissionIfNeeded();
      } catch {}
      try {
        await initAds();
        loadInterstitial().catch(() => {});
        loadRewarded().catch(() => {});
      } catch (e) {
        console.warn('[onboarding] ad init failed:', e?.message);
      }
    })();
  };

  const handleAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (key === 'goal' && GOAL_TO_PATH[value]) {
      setSelectedPath(GOAL_TO_PATH[value]);
    }
  };

  const handleNext = () => {
    Keyboard.dismiss();
    if (step === 'personalize') {
      setStep('pickPath');
    } else if (step === 'pickPath') {
      setStep('archetype');
    } else if (step === 'archetype') {
      if (isPremium) {
        finishOnboarding();
      } else {
        setStep('upsell');
      }
    } else {
      finishOnboarding();
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  };

  const handleUpsellSubscribe = () => {
    setUserProfile({
      name: (answers.name || '').trim() || null,
      goals: answers.goal ? [answers.goal] : ['discipline'],
      archetype: selectedArchetype,
      answers,
    });
    setActivePath(selectedPath);

    const firstLesson = `${selectedPath}-1`;
    try {
      navigation?.navigate?.('Paywall', {
        source: 'onboarding_upsell',
        afterClose: {
          name: 'Lesson',
          params: { pathId: selectedPath, lessonId: firstLesson },
        },
      });
    } catch {}
    completeOnboarding();

    track({
      event: 'onboarding_completed',
      userId: user?.id,
      props: {
        path: selectedPath,
        archetype: selectedArchetype,
        goal: answers.goal,
        time: answers.time,
        mood: answers.mood,
        isPremium: !!isPremium,
        next: 'paywall',
      },
    });

    (async () => {
      try {
        const granted = await requestNotificationPermissions();
        if (granted) {
          scheduleDailyReminder({
            currentStreak: 0,
            userName: answers.name || '',
            archetypeName: t(
              getArchetypeById(selectedArchetype).nameKey,
              getArchetypeById(selectedArchetype).nameFallback,
            ),
            activePathId: selectedPath,
          }).catch(() => {});
          scheduleWeeklyRecap().catch(() => {});
          scheduleFirstWeekHooks({ userName: answers.name || '' }).catch(
            () => {},
          );
        }
      } catch {}
      try { await requestTrackingPermissionIfNeeded(); } catch {}
      try {
        await initAds();
        loadInterstitial().catch(() => {});
        loadRewarded().catch(() => {});
      } catch {}
    })();
  };

  const canAdvance = true;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoider}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={LT.background} />
        <View style={styles.container}>
          <View style={styles.heroGlow} pointerEvents="none" />

        {step === 'personalize' ? (
          <PersonalizeStep t={t} answers={answers} onAnswer={handleAnswer} />
        ) : step === 'pickPath' ? (
          <PickPathStep
            t={t}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        ) : step === 'archetype' ? (
          <ArchetypeStep
            t={t}
            selectedArchetype={selectedArchetype}
            onSelect={setSelectedArchetype}
          />
        ) : (
          <UpsellStep t={t} onSubscribe={handleUpsellSubscribe} />
        )}

          <View style={styles.bottomArea}>
            <View style={styles.progressHeader}>
              {stepIndex > 0 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('common.back', 'Geri')}
                  onPress={handleBack}
                  style={styles.backButton}
                >
                  <MaterialIcons name="arrow-back" size={18} color={LT.onSurface} />
                  <Text style={styles.backText}>{t('common.back', 'Geri')}</Text>
                </TouchableOpacity>
              ) : <View style={styles.progressSpacer} />}
              <View style={styles.dots} accessible={false}>
                {STEPS.map((s) => {
                  const active = step === s;
                  return (
                    <View
                      key={s}
                      style={[
                        styles.dot,
                        active && styles.dotActive,
                      ]}
                    />
                  );
                })}
              </View>
              <Text
                accessibilityLabel={t('onboarding.stepProgress', {
                  current: stepIndex + 1,
                  total: STEPS.length,
                  defaultValue: `Step ${stepIndex + 1} of ${STEPS.length}`,
                })}
                style={styles.stepCount}
              >
                {stepIndex + 1}/{STEPS.length}
              </Text>
            </View>

          <TouchableOpacity
            onPress={canAdvance ? handleNext : undefined}
            activeOpacity={canAdvance ? 0.9 : 1}
            style={[styles.primaryWrap, !canAdvance && styles.primaryWrapDisabled]}
          >
            <View style={[styles.primaryButton, !canAdvance && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonText}>
                {step === 'personalize'
                  ? t('onboarding.continuePersonalize', 'Devam et')
                  : step === 'pickPath'
                    ? t('onboarding.startPath', 'Bu yolu başlat')
                    : step === 'archetype'
                      ? t('onboarding.continueArchetype', 'Bu benim')
                      : t('onboarding.skipUpsell', 'Şimdilik Atla')}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <Text style={styles.caption}>
            {step === 'personalize'
              ? t('onboarding.captionPersonalize', 'SANA UYAN PLANI KURALIM')
              : step === 'pickPath'
                ? t('onboarding.captionPickPath', 'ÖNCE TEK BİR ŞEYİ DÜZELT')
                : step === 'archetype'
                  ? t('onboarding.captionArchetype', '30 GÜNLÜK NİYETİNİ SEÇ')
                  : t('onboarding.captionUpsell', 'RİTMİ KESMEDEN DEVAM ET')}
          </Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: LT.background },
  container: { flex: 1, backgroundColor: LT.background },

  heroGlow: {
    position: 'absolute',
    top: '8%',
    left: '50%',
    width: 300,
    height: 300,
    marginLeft: -150,
    borderRadius: 150,
    backgroundColor: LT.outlineVariant,
    opacity: 0.25,
    transform: [{ scale: 1.4 }],
  },

  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
    gap: 16,
  },
  progressHeader: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: LT.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  progressSpacer: { width: 48 },
  stepCount: {
    minWidth: 48,
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LT.outlineVariant,
  },
  dotActive: {
    backgroundColor: LT.primary,
    width: 28,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },

  primaryWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: LT.primary,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryWrapDisabled: {
    backgroundColor: LT.outlineVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.primary,
  },
  primaryButtonDisabled: {
    backgroundColor: LT.outlineVariant,
    opacity: 0.6,
  },
  primaryButtonText: {
    color: LT.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  caption: {
    fontSize: 10,
    color: LT.onSurfaceVariant,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
