import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
  Image,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useApp } from '../contexts/AppContext';
import {
  getPathById,
  getLessonById,
  isPathComplete,
  getCurrentLesson,
} from '../data/paths';
import { PATHS } from '../data/paths';
import { getAdaptiveQuiz } from '../services/adaptiveQuiz';
import {
  showInterstitial,
  shouldShowAd,
  requestTrackingPermissionIfNeeded,
  showRewarded,
  isRewardedReady,
  loadRewarded,
} from '../services/ads';
import StreakRepairModal from '../components/StreakRepairModal';
import MilestoneModal, { isMilestone } from '../components/MilestoneModal';
import PathMilestoneScene, {
  detectPathSceneStage,
} from '../components/PathMilestoneScene';
import SageMode from '../components/SageMode';
import OutOfHeartsModal from '../components/OutOfHeartsModal';
import { playSound } from '../services/sounds';
import { speak as ttsSpeak, stop as ttsStop } from '../services/tts';
import {
  startRecording,
  stopRecording,
  playRecording,
} from '../services/voiceRecording';
import { getCurrentLanguage } from '../i18n';
import { getFirstName } from '../services/displayName';
import { useAuth } from '../contexts/AuthContext';
import { requestReviewIfAppropriate } from '../services/review';
import { maybeTriggerPostLessonPaywall } from '../services/paywallTrigger';
import { mirrorReflection } from '../services/reflectionMirror';
import { LT, LT_RADIUS } from '../config/lightTheme';
import { useAppMood } from '../hooks/useAppMood';

const STEP = {
  HOOK: 'hook',
  TEACHING: 'teaching',
  PRACTICE: 'practice',
  QUIZ: 'quiz',
  COMMIT: 'commit',
};

const REFLECTION_MAX = 250;

export default function LessonScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { pathId, lessonId } = route.params || {};
  const {
    completePathLesson,
    pathProgress,
    isPremium,
    currentStreak,
    hearts,
    heartsRefillAt,
    loseHeart,
    refillHearts,
    isInGracePeriod,
    grantBonusXP,
    earnHeart,
    dailyLessonsCount,
    dailyGoalTarget,
    _dailyGoalToast,
    clearDailyGoalToast,
    quizAnswers,
    recordQuizAnswer,
    pendingStreakRestore,
    streakFreezes,
    restoreBrokenStreak,
    dismissBrokenStreakRestore,
    userProfile,
    anonUsername,
  } = useApp();
  const { user } = useAuth();
  // Centralized name resolution — same priority as Home + Notifications.
  const firstName = getFirstName({ userProfile, user, anonUsername, fallback: '' });

  // Top-level totalCompleted for the mood hook. There's a separate local
  // const named totalCompleted inside the completion handler below; this
  // one is component-scoped so the hook stays at the top level (rules of
  // hooks) and re-derives only when pathProgress changes.
  const totalCompletedForMood = useMemo(
    () =>
      Object.values(pathProgress || {}).reduce(
        (sum, p) => sum + (p?.completed?.length || 0),
        0,
      ),
    [pathProgress],
  );
  // Time-aware UI mood (palette/tone + optional background tint). See
  // hooks/useAppMood.js. Rendered as an absolute pointerEvents-none
  // overlay below so it never blocks lesson interaction.
  const mood = useAppMood({
    currentStreak,
    totalCompleted: totalCompletedForMood,
  });

  const path = useMemo(() => getPathById(pathId), [pathId]);
  const lesson = useMemo(() => getLessonById(lessonId), [lessonId]);
  // Adaptive quiz (#2A) — append 1-2 review questions from prior lessons
  // in the same path when the user has demonstrated accuracy. Snapshot
  // at lesson mount so the question set is stable across re-renders
  // (otherwise random picks would jitter on every state update).
  const adaptiveQuizRef = useRef(null);
  if (adaptiveQuizRef.current === null && path && lesson) {
    adaptiveQuizRef.current = getAdaptiveQuiz({
      t,
      pathId,
      lessonOrder: lesson.order,
      pathProgress,
      quizAnswers,
    });
  }
  const adaptiveQuiz = adaptiveQuizRef.current || {
    questions: [],
    baseLength: 0,
    bonusCount: 0,
  };

  // NEW SCHEMA: scenarioQuiz overrides the base quiz when present. The
  // adaptive engine still gathers from `.quiz` (which we keep on every
  // lesson as a fallback) for review/bonus picks from PRIOR lessons —
  // but for the CURRENT lesson, we render scenarioQuiz as base if it
  // exists. Bonus picks (adaptiveQuiz.bonusMeta) are appended after.
  const scenarioQuizRaw = path && lesson
    ? t(`lessons.${pathId}.${lesson.order}.scenarioQuiz`, { returnObjects: true })
    : null;
  const scenarioQuiz = Array.isArray(scenarioQuizRaw) ? scenarioQuizRaw : null;
  // When scenarioQuiz is present, replace the base portion of the
  // adaptive questions; keep the bonus review tail intact.
  const bonusTail = adaptiveQuiz.questions.slice(adaptiveQuiz.baseLength);
  const quiz = scenarioQuiz
    ? [...scenarioQuiz, ...bonusTail]
    : adaptiveQuiz.questions;
  const baseQuizLength = scenarioQuiz
    ? scenarioQuiz.length
    : adaptiveQuiz.baseLength;

  // NEW SCHEMA: probe optional fields for the dynamic step machine.
  // Detection is presence-based — a field is "active" if it returns a
  // non-empty value/array from i18n. Old short lessons resolve to
  // empty/key-name fallbacks and skip the new steps entirely.
  const hookKey = path && lesson ? `lessons.${pathId}.${lesson.order}.hook` : '';
  const hookRaw = hookKey ? t(hookKey, '') : '';
  const hookText = hookRaw && hookRaw !== hookKey ? hookRaw : '';
  const hasHook = hookText.length > 0;

  const practiceRaw = path && lesson
    ? t(`lessons.${pathId}.${lesson.order}.practice`, { returnObjects: true })
    : null;
  const practiceObj =
    practiceRaw &&
    typeof practiceRaw === 'object' &&
    !Array.isArray(practiceRaw) &&
    typeof practiceRaw.instruction === 'string' &&
    typeof practiceRaw.seconds === 'number'
      ? practiceRaw
      : null;
  const hasPractice = !!practiceObj;

  // Initial step: HOOK if available, otherwise the legacy TEACHING.
  const [step, setStep] = useState(hasHook ? STEP.HOOK : STEP.TEACHING);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const [reflection, setReflection] = useState('');
  const [actionDone, setActionDone] = useState(false);
  const [completing, setCompleting] = useState(false);
  // NEW SCHEMA: practice step state.
  // - practiceStarted: user has tapped "Başlat" — timer is running.
  // - practiceSecondsLeft: integer countdown shown on the timer ring.
  // - practiceFinished: timer hit 0 OR user tapped "Atla". Unlocks
  //   the continue CTA for the practice step.
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [practiceSecondsLeft, setPracticeSecondsLeft] = useState(
    practiceObj ? practiceObj.seconds : 0,
  );
  const [practiceFinished, setPracticeFinished] = useState(false);
  // Practice-step reflection (the post-timer prompt). Separate from the
  // commit-step reflection so the two don't overwrite each other.
  const [practiceNote, setPracticeNote] = useState('');
  // NEW SCHEMA: selectedCommitment — index into commitments[]. When
  // commitments is null (old lessons), we still use the legacy
  // actionDone checkbox flow. When commitments is set, picking one
  // both selects it AND counts as "actionDone".
  const [selectedCommitment, setSelectedCommitment] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const [milestoneStreak, setMilestoneStreak] = useState(0);
  // Path-specific narrative scene (10/20/30/40/50 lessons within a path).
  // Renders the PathMilestoneScene modal — chapter-style story beat.
  const [pathSceneVisible, setPathSceneVisible] = useState(false);
  const [pathSceneStage, setPathSceneStage] = useState(0);
  // Premium-only Sage Mode deep session. Triggered from celebration
  // screen — full-screen TTS-guided 15-min experience.
  const [sageModeVisible, setSageModeVisible] = useState(false);
  const [outOfHeartsVisible, setOutOfHeartsVisible] = useState(false);
  // Cumulative crit-hit bonus XP accumulated during this lesson's quiz.
  // Forwarded to completePathLesson on completion so the user actually
  // sees the bonus on top of their lesson XP. Reset on every mount.
  const [critBonusXP, setCritBonusXP] = useState(0);
  // Transient toast for a fresh crit — populated on a critical hit,
  // cleared 1.4s later. The renderer overlays a "CRITICAL +25 XP" flash.
  const [critFlash, setCritFlash] = useState(0);
  // Reflection Mirror quote — populated when handleComplete fires, if
  // the user wrote a reflection. Surfaces on celebration screen as
  // "a sage responds to your words". Empathy/voice-of-the-app hook.
  const [mirrorQuote, setMirrorQuote] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const playbackRef = useRef(null);

  // Async-safe state updates: many things in this screen race against the
  // user navigating away (haptics, sounds, TTS, completion celebration). If a
  // setState fires after unmount React logs a warning AND the update is lost
  // — but the operation tail can also crash if it touches refs. Gate the
  // setState calls on this flag.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ttsStop().catch(() => {});
    };
  }, []);
  const safeSet = (setter) => (...args) => {
    if (mountedRef.current) setter(...args);
  };

  const handleToggleRecord = async () => {
    if (recording) {
      const uri = await stopRecording();
      safeSet(setRecording)(false);
      if (uri) safeSet(setRecordingUri)(uri);
      return;
    }
    // Stop any active narration before recording so the mic isn't fighting
    // the speaker.
    if (isSpeaking) {
      await ttsStop();
      safeSet(setIsSpeaking)(false);
    }
    const ok = await startRecording();
    if (ok) safeSet(setRecording)(true);
  };

  const handlePlayRecording = async () => {
    if (!recordingUri) return;
    if (playbackRef.current) {
      try {
        await playbackRef.current.stopAsync();
        await playbackRef.current.unloadAsync();
      } catch {}
      playbackRef.current = null;
    }
    const sound = await playRecording(recordingUri);
    playbackRef.current = sound;
  };

  const handleToggleSpeak = async () => {
    if (isSpeaking) {
      await ttsStop();
      safeSet(setIsSpeaking)(false);
      return;
    }
    if (!teaching) return;
    safeSet(setIsSpeaking)(true);
    const lang = getCurrentLanguage?.() === 'en' ? 'en-US' : 'tr-TR';
    const ok = await ttsSpeak(teaching, {
      lang,
      onDone: () => safeSet(setIsSpeaking)(false),
      onError: () => safeSet(setIsSpeaking)(false),
    });
    if (!ok) safeSet(setIsSpeaking)(false);
  };

  // Heart refill countdown is now handled by LiveCountdown inside
  // OutOfHeartsModal — passing `refillAt={heartsRefillAt}` makes the
  // modal tick down to zero on its own each second. The old local
  // `now` state + every-30s setInterval was redundant.

  // Mount-time hearts guard: if a free user lands on a Lesson with 0
  // hearts (e.g. tapped Home "next lesson" card, deep-linked from
  // notification), bounce them out IMMEDIATELY with the OutOfHearts
  // modal. Skipped during the new-user grace period because hearts
  // aren't being consumed there anyway.
  useEffect(() => {
    if (alreadyCompleted) return; // re-visiting a finished lesson is OK
    if (isInGracePeriod) return; // grace period — hearts not enforced
    if (!isPremium && (hearts || 0) <= 0) {
      setOutOfHeartsVisible(true);
    }
    // Only check on first mount. Hooks aren't in the dep array so a
    // mid-lesson hearts change doesn't pop the modal unexpectedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebrationScale = useRef(new Animated.Value(0)).current;
  const xpY = useRef(new Animated.Value(0)).current;
  const stepProgress = useRef(new Animated.Value(0.33)).current;
  // Practice-step countdown. Animated 0 → 1 over (seconds * 1000)ms.
  // The Animated.Value drives both the visible ring fill AND the
  // displayed integer seconds-left (via an Animated.listener that
  // setStates the integer text — RN can't render Animated values as
  // text directly).
  const practiceAnim = useRef(new Animated.Value(0)).current;
  const practiceAnimRef = useRef(null); // current Animated.timing handle

  const alreadyCompleted = pathProgress?.[pathId]?.completed?.includes(lessonId);

  // DYNAMIC STEP MACHINE — list of steps to walk through for THIS lesson.
  // Presence-based: a step is included only when its source field
  // exists. Old lessons (no hook / no practice) produce the legacy
  // [TEACHING, QUIZ, COMMIT] sequence.
  const steps = useMemo(
    () =>
      [
        hasHook ? STEP.HOOK : null,
        STEP.TEACHING,
        hasPractice ? STEP.PRACTICE : null,
        quiz.length > 0 ? STEP.QUIZ : null,
        STEP.COMMIT,
      ].filter(Boolean),
    [hasHook, hasPractice, quiz.length],
  );

  // Drive the top progress bar from where we are in the step list.
  // First step = 1/N filled, last step = 1.0. Falls back to 0.33 when
  // step isn't in the list (defensive — shouldn't happen).
  useEffect(() => {
    const idx = steps.indexOf(step);
    const target = idx >= 0 && steps.length > 0
      ? (idx + 1) / steps.length
      : 0.33;
    Animated.timing(stepProgress, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, steps, stepProgress]);

  // Helper: jump to the step AFTER the current one in the dynamic list.
  // If we're at the last step, this is a no-op (the COMMIT step's CTA
  // triggers handleComplete instead).
  const goToNextStep = (current) => {
    const idx = steps.indexOf(current);
    if (idx < 0 || idx >= steps.length - 1) return null;
    return steps[idx + 1];
  };

  // Wire the practice Animated.Value to a state-backed integer text.
  // Update only when the displayed seconds actually change (so we
  // don't churn setState 60fps). Effect runs every render but the
  // listener registration is idempotent. Pulled UP here (above the
  // path/lesson early-return) to keep the hook-call order stable.
  useEffect(() => {
    if (!practiceObj) return undefined;
    const id = practiceAnim.addListener(({ value }) => {
      const left = Math.max(0, Math.ceil(practiceObj.seconds * (1 - value)));
      setPracticeSecondsLeft((prev) => (prev === left ? prev : left));
    });
    return () => {
      practiceAnim.removeListener(id);
    };
  }, [practiceAnim, practiceObj]);

  // Cleanup: stop the timer if user navigates away mid-practice.
  useEffect(() => {
    return () => {
      if (practiceAnimRef.current) {
        practiceAnimRef.current.stop();
        practiceAnimRef.current = null;
      }
    };
  }, []);

  if (!path || !lesson) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('common.error', 'Hata')}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={styles.backText}>{t('common.back', 'Geri')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const i18nBase = `lessons.${pathId}.${lesson.order}`;
  const title = t(`${i18nBase}.title`, `${lesson.order}`);
  // NEW SCHEMA: teachingDeep (200-300 word version) replaces teaching
  // when present. Falls back to the short legacy teaching otherwise.
  const teachingShort = t(`${i18nBase}.teaching`, '');
  const teachingDeepKey = `${i18nBase}.teachingDeep`;
  const teachingDeepRaw = t(teachingDeepKey, '');
  const teachingDeep =
    teachingDeepRaw && teachingDeepRaw !== teachingDeepKey
      ? teachingDeepRaw
      : '';
  const teaching = teachingDeep || teachingShort;
  const action = t(`${i18nBase}.action`, '');
  const reflectionPrompt = t(`${i18nBase}.reflectionPrompt`, '');
  // NEW SCHEMA: reflectionPrompts (array) overrides single reflectionPrompt.
  const reflectionPromptsRaw = t(`${i18nBase}.reflectionPrompts`, {
    returnObjects: true,
  });
  const reflectionPrompts = Array.isArray(reflectionPromptsRaw)
    ? reflectionPromptsRaw
    : null;
  // NEW SCHEMA: commitments (array of 3 strings — user picks one) overrides
  // the single `action`. When present, the commit step shows pickable
  // cards; the picked text becomes the commitment that's marked done.
  const commitmentsRaw = t(`${i18nBase}.commitments`, { returnObjects: true });
  const commitments = Array.isArray(commitmentsRaw) ? commitmentsRaw : null;
  const proTipKey = `${i18nBase}.proTip`;
  const proTipRaw = t(proTipKey, '');
  const proTip = proTipRaw && proTipRaw !== proTipKey ? proTipRaw : '';
  const hasQuiz = quiz.length > 0;
  const currentQuestion = hasQuiz ? quiz[quizIndex] : null;

  // Walk forward in the dynamic step list. Used by every step's
  // "continue" CTA — HOOK → TEACHING, TEACHING → PRACTICE/QUIZ/COMMIT,
  // PRACTICE → QUIZ/COMMIT, etc. Each renderer's CTA calls this with
  // its own step name so we don't have to hardcode pairwise links.
  const advanceFrom = (current) => {
    playSound('tap').catch(() => {});
    const next = goToNextStep(current);
    if (next) setStep(next);
  };

  // Legacy handler retained as a thin wrapper (callers downstream may
  // expect this name). Behaves correctly for old AND new lessons via
  // the dynamic step list.
  const handleTeachingNext = () => advanceFrom(STEP.TEACHING);

  // PRACTICE step controls — start the countdown, skip it, or react to
  // it finishing. Animation drives both the ring fill and the visible
  // integer seconds-left via a listener.
  const handleStartPractice = () => {
    if (!practiceObj || practiceStarted) return;
    playSound('tap').catch(() => {});
    Haptics.selectionAsync().catch(() => {});
    setPracticeStarted(true);
    setPracticeFinished(false);
    practiceAnim.setValue(0);
    practiceAnimRef.current = Animated.timing(practiceAnim, {
      toValue: 1,
      duration: practiceObj.seconds * 1000,
      easing: Easing.linear,
      // We're reading the value in a listener (for the integer text)
      // and binding it to a non-transform style (the ring's width), so
      // we MUST stay on the JS driver.
      useNativeDriver: false,
    });
    practiceAnimRef.current.start(({ finished }) => {
      if (!finished) return;
      // Timer ran to completion (not interrupted by Skip).
      safeSet(setPracticeFinished)(true);
      safeSet(setPracticeSecondsLeft)(0);
      playSound('correct').catch(() => {});
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    });
  };

  const handleSkipPractice = () => {
    if (!practiceObj) return;
    playSound('tap').catch(() => {});
    if (practiceAnimRef.current) {
      practiceAnimRef.current.stop();
      practiceAnimRef.current = null;
    }
    setPracticeStarted(true);
    setPracticeFinished(true);
    setPracticeSecondsLeft(0);
  };

  const handlePracticeContinue = () => advanceFrom(STEP.PRACTICE);
  const handleHookContinue = () => advanceFrom(STEP.HOOK);

  const handleQuizAnswer = (idx) => {
    if (revealed) return;
    setSelectedAnswer(idx);
    setRevealed(true);
    const isCorrect = idx === currentQuestion.correct;
    // Record per-question answer for the adaptive engine.
    //
    // Original quiz questions (quizIndex < baseQuizLength): record
    // under the current lesson — this is the canonical answer log.
    //
    // Review/bonus questions (quizIndex >= baseQuizLength): record
    // under the ORIGINAL lesson's id+qIndex via bonusMeta. We want the
    // user's latest attempt at that concept to update the adaptive
    // engine's view of mastery; logging under the current lesson would
    // (a) lose the original record's existence and (b) double-count
    // the same answer in path-level accuracy.
    if (quizIndex < baseQuizLength) {
      recordQuizAnswer({
        lessonId,
        questionIndex: quizIndex,
        correct: isCorrect,
      });
    } else {
      const bonusIdx = quizIndex - baseQuizLength;
      const meta = adaptiveQuiz.bonusMeta?.[bonusIdx];
      if (meta) {
        recordQuizAnswer({
          lessonId: meta.fromLessonId,
          questionIndex: meta.fromQIndex,
          correct: isCorrect,
        });
      }
    }
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      playSound('correct').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // CRITICAL HIT — 5% chance to grant +25 XP bonus on a correct
      // answer. Variable reward mechanic; nondeterministic surprises
      // are way more engaging than predictable XP. The bonus is
      // accumulated and forwarded with the lesson completion.
      if (Math.random() < 0.05) {
        setCritBonusXP((b) => b + 25);
        setCritFlash((c) => c + 1); // re-trigger flash animation
        playSound('milestone').catch(() => {});
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        // Auto-clear flash after 1.4s so the next question isn't blocked.
        setTimeout(() => setCritFlash(0), 1400);
      }
    } else {
      playSound('wrong').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      // New-user grace: in the first 24h after install, free users do
      // not lose hearts on wrong answers. This dramatically improves
      // day-1 retention — a new user who makes a mistake in their
      // first quiz won't get instantly blocked by a 0-hearts modal.
      if (!isPremium && !isInGracePeriod) {
        if (hearts > 0) {
          loseHeart();
        }
        // Show the modal in two cases:
        //  1) This wrong answer just consumed the user's last heart.
        //  2) The user was already at 0 hearts when the wrong answer
        //     fired — previously silently ignored, defeating the
        //     entire purpose of the hearts mechanic.
        if (hearts <= 1) {
          // safeSet so we don't update state after the user has
          // navigated away from the lesson (would warn + leak).
          setTimeout(() => safeSet(setOutOfHeartsVisible)(true), 800);
        }
      }
    }
  };

  const handleQuizContinue = () => {
    setSelectedAnswer(null);
    setRevealed(false);
    if (quizIndex + 1 < quiz.length) setQuizIndex((i) => i + 1);
    else {
      // End of quiz → advance to whatever the next step is (usually
      // COMMIT, but the dynamic step list is the source of truth).
      const next = goToNextStep(STEP.QUIZ);
      if (next) setStep(next);
    }
  };

  const handleComplete = async () => {
    if (completing || alreadyCompleted) return;
    setCompleting(true);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playSound('complete').catch(() => {});
    } catch {}

    // NEW SCHEMA: stitch the practice note + chosen commitment into
    // the reflection payload so they're persisted in the same field
    // as legacy reflections (no reducer changes needed). The user's
    // free-form reflection still leads; the structured bits get
    // appended after a separator only when they have content.
    const userReflection = reflection.trim();
    const practiceNoteTrim = practiceNote.trim();
    const chosenCommitment =
      commitments && selectedCommitment !== null
        ? commitments[selectedCommitment]
        : '';
    const parts = [];
    if (userReflection) parts.push(userReflection);
    if (practiceNoteTrim) parts.push(`PRATİK: ${practiceNoteTrim}`);
    if (chosenCommitment) parts.push(`TAAHHÜT: ${chosenCommitment}`);
    const compositeReflection = parts.join('\n\n');

    // Reflection Mirror — if the user wrote anything, pick a matching
    // quote from our curated library and surface it on the celebration
    // screen. Empathy hook: the app "heard" them. Fire-and-forget;
    // pure local logic, no async.
    const trimmedReflection = userReflection;
    if (trimmedReflection) {
      try {
        const lang = getCurrentLanguage();
        const { quote } = mirrorReflection(trimmedReflection, lang);
        if (quote) setMirrorQuote(quote);
      } catch {
        // Mirror is a feature add — never block lesson completion on it.
      }
    }

    completePathLesson({
      pathId,
      lessonId,
      reflection: compositeReflection,
      reflectionAudioUri: recordingUri || null,
      quizCorrect: correctCount,
      // Total quiz length is forwarded so the reducer can detect a
      // "perfect lesson" (all quiz correct) and grant the bonus XP.
      quizTotal: quiz.length,
      // Base XP + any crit-hit bonuses accumulated during the quiz.
      // critBonusXP is granted as raw bonus, NOT subject to the
      // multipliers (already a bonus mechanic on its own).
      xp: 15 + correctCount * 5 + critBonusXP,
    });

    setShowCelebration(true);

    Animated.sequence([
      Animated.spring(celebrationScale, {
        toValue: 1,
        damping: 8,
        stiffness: 180,
        useNativeDriver: true,
      }),
      Animated.timing(xpY, {
        toValue: -60,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Show milestone modal if this completion crossed a streak milestone.
    // 1.8s lag means the user might have navigated away — safeSet skips
    // setState if the screen is gone.
    setTimeout(() => {
      const newStreak = currentStreak + 1;
      if (isMilestone(newStreak)) {
        safeSet(setMilestoneStreak)(newStreak);
        safeSet(setMilestoneVisible)(true);
        playSound('milestone').catch(() => {});
      }
      // Path-specific narrative scene — fires when the user just
      // crossed the 10/20/30/40/50th lesson WITHIN the current path.
      // This is a separate hook from the streak-day milestone above;
      // both can fire on the same completion in rare cases (e.g. day
      // 30 streak + path lesson 30). UX-wise that's fine — they're
      // sequenced modally.
      const pathCompletedAfter =
        (pathProgress?.[pathId]?.completed?.length || 0) + 1;
      const scene = detectPathSceneStage(pathCompletedAfter);
      if (scene) {
        safeSet(setPathSceneStage)(scene);
        safeSet(setPathSceneVisible)(true);
      }
    }, 1800);
    // No auto-dismiss — user picks "Yola Dön" or "Sonraki Ders" from celebration
  };

  const handleCelebrationContinue = async () => {
    // Drop the daily-goal toast now that the user has acknowledged the
    // celebration. Otherwise a subsequent lesson within the same
    // session would re-render the +50 XP pill even though the bonus
    // already fired once.
    if (_dailyGoalToast) clearDailyGoalToast();

    const totalCompleted = Object.values(pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    ) + 1; // +1 for the lesson just finished

    // ATT prompt — only after user has experienced the app (1st lesson).
    // Apple guideline: don't ask for tracking before user understands app.
    if (totalCompleted === 1) {
      requestTrackingPermissionIfNeeded().catch(() => {});
    }

    // Store review prompt — gated to >= 3 lessons, >= 2 streak, 24h since last.
    requestReviewIfAppropriate({
      lessonsCompleted: totalCompleted,
      streak: currentStreak + 1,
    }).catch(() => {});

    // Peak-emotional-moment paywall: after the 3rd lesson, the user has
    // felt the streak forming and is most likely to convert. One-shot
    // (tracked in AsyncStorage so we don't keep nagging). Free users only;
    // premium users skip directly to the next step.
    const shouldShowPostLessonPaywall = await maybeTriggerPostLessonPaywall({
      lessonsCompleted: totalCompleted,
      isPremium,
    });
    if (shouldShowPostLessonPaywall) {
      // Replace the lesson screen with Paywall so back-button goes Home,
      // not back into the just-completed lesson.
      navigation.replace('Paywall');
      return;
    }

    // Show interstitial ad before exiting (frequency-capped)
    if (!isPremium && shouldShowAd(false)) {
      try { await showInterstitial(); } catch {}
    }
    navigation.goBack();
  };

  const handleNextLesson = async () => {
    // Same cleanup as handleCelebrationContinue — the toast belongs to
    // *this* completion's celebration, not to the next lesson the user
    // is about to start.
    if (_dailyGoalToast) clearDailyGoalToast();

    // Find the next lesson in the same path that isn't completed
    const completedSet = new Set(pathProgress?.[pathId]?.completed || []);
    completedSet.add(lessonId); // include the just-completed one
    const sortedLessons = path && path.id
      ? Array.from({ length: path.duration }, (_, i) => `${path.id}-${i + 1}`)
      : [];
    const nextLessonId = sortedLessons.find((id) => !completedSet.has(id));

    if (!nextLessonId) {
      // Path complete — go back to PathScreen which will show celebration
      handleCelebrationContinue();
      return;
    }
    if (!isPremium && shouldShowAd(false)) {
      try { await showInterstitial(); } catch {}
    }
    // replace so the back button goes to PathScreen, not the previous lesson
    navigation.replace('Lesson', { pathId, lessonId: nextLessonId });
  };

  const handleMilestoneClose = async () => {
    setMilestoneVisible(false);
    if (!isPremium && shouldShowAd(false)) {
      try { await showInterstitial(); } catch {}
    }
    navigation.goBack();
  };

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.closeBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialIcons name="close" size={22} color={LT.onSurfaceVariant} />
      </TouchableOpacity>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFillWrap,
            {
              width: stepProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={[LT.primaryContainer, LT.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        </Animated.View>
      </View>
      {!isPremium && (
        <View style={styles.heartsBadge}>
          <MaterialIcons name="favorite" size={16} color="#EF4444" />
          <Text style={styles.heartsText}>{hearts}</Text>
        </View>
      )}
    </View>
  );

  // NEW SCHEMA: HOOK step — opens the lesson with a sharp scenario or
  // pointed question. Single short block; no quiz, no proTip, just the
  // hook text + the lesson title (so the user has context). The CTA
  // ("Devam et") sits in the bottom bar like every other step.
  const renderHook = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepLabel}>{t('lesson.hook', 'GİRİŞ')}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.hookCard}>
        <Text style={styles.hookText}>{hookText}</Text>
      </View>
      <View style={{ height: 120 }} />
    </ScrollView>
  );

  const renderTeaching = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepLabel}>📖 {t('lesson.teaching', 'ÖĞRETİM')}</Text>
      {/* If we already showed the HOOK step, the title is now redundant
          at the top of TEACHING — but keep it for the legacy short-lesson
          path where TEACHING is the first step the user sees. */}
      {hasHook ? null : <Text style={styles.title}>{title}</Text>}

      {hasHook ? null : (
        <View style={styles.heroBox}>
          <LinearGradient
            colors={[LT.surfaceContainerLowest, LT.surfaceContainerLowest]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroMascot}>
            <MaterialIcons name="self-improvement" size={68} color={LT.primaryContainer} />
          </View>
        </View>
      )}

      <View style={styles.teachingCard}>
        <View style={styles.cornerAccent} />
        <TouchableOpacity
          onPress={handleToggleSpeak}
          activeOpacity={0.85}
          style={styles.speakBtn}
          accessibilityLabel={
            isSpeaking
              ? t('lesson.stopAudio', 'Sesi durdur')
              : t('lesson.playAudio', 'Sesli oku')
          }
        >
          <MaterialIcons
            name={isSpeaking ? 'stop' : 'volume-up'}
            size={18}
            color={LT.onPrimary}
          />
          <Text style={styles.speakBtnText}>
            {isSpeaking
              ? t('lesson.stopAudio', 'Durdur')
              : t('lesson.playAudio', 'Sesli dinle')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.teachingText}>{teaching}</Text>
      </View>

      {proTip ? (
        <View style={styles.proTipBox}>
          <MaterialIcons name="lightbulb" size={22} color="#FDE047" />
          <View style={{ flex: 1 }}>
            <Text style={styles.proTipLabel}>{t('lesson.proTip', 'PRO İPUCU')}</Text>
            <Text style={styles.proTipBody}>{proTip}</Text>
          </View>
        </View>
      ) : null}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // NEW SCHEMA: PRACTICE step — in-lesson exercise.
  // - Idle:    show the instruction + a big "Başlat" button.
  // - Running: show a countdown ring + the integer seconds left.
  //            User can tap "Atla" to skip.
  // - Done:    show the post-timer prompt (if any) with a text input.
  //            Continue CTA in the bottom bar is unlocked.
  const renderPractice = () => {
    if (!practiceObj) return null;
    const total = practiceObj.seconds;
    const ringFill = practiceAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepLabel}>{t('lesson.practice', 'PRATİK')}</Text>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.practiceInstructionCard}>
          <MaterialIcons name="self-improvement" size={28} color={LT.primaryContainer} />
          <Text style={styles.practiceInstructionText}>
            {practiceObj.instruction}
          </Text>
        </View>

        {/* Timer block — bar fill (linear, not a circular ring, to
            stay framework-light without bringing in SVG) + the big
            integer seconds-left countdown. */}
        <View style={styles.practiceTimerWrap}>
          <Text style={styles.practiceTimerNumber}>
            {practiceStarted ? practiceSecondsLeft : total}
            <Text style={styles.practiceTimerUnit}>s</Text>
          </Text>
          <View style={styles.practiceTimerTrack}>
            <Animated.View
              style={[
                styles.practiceTimerFill,
                { width: practiceStarted ? ringFill : '0%' },
              ]}
            />
          </View>
        </View>

        {!practiceStarted ? (
          <TouchableOpacity
            onPress={handleStartPractice}
            activeOpacity={0.9}
            style={styles.practiceStartBtn}
          >
            <MaterialIcons name="play-arrow" size={22} color={LT.onPrimary} />
            <Text style={styles.practiceStartBtnText}>
              {t('lesson.practiceStart', 'Başlat')}
            </Text>
          </TouchableOpacity>
        ) : !practiceFinished ? (
          <TouchableOpacity
            onPress={handleSkipPractice}
            activeOpacity={0.85}
            style={styles.practiceSkipBtn}
          >
            <Text style={styles.practiceSkipBtnText}>
              {t('lesson.practiceSkip', 'Atla')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {practiceFinished && practiceObj.prompt ? (
          <View style={styles.practicePromptWrap}>
            <Text style={styles.practicePromptLabel}>{practiceObj.prompt}</Text>
            <TextInput
              value={practiceNote}
              onChangeText={(txt) => setPracticeNote(txt.slice(0, REFLECTION_MAX))}
              placeholder={t('lesson.reflectionPlaceholder', 'Düşüncelerini buraya yaz...')}
              placeholderTextColor={LT.outline}
              multiline
              style={styles.reflectionInput}
            />
            <View style={styles.reflectionMeta}>
              <Text style={styles.reflectionMetaText}>
                {t('lesson.optional', 'OPSİYONEL')}
              </Text>
              <Text style={styles.reflectionMetaText}>
                {practiceNote.length} / {REFLECTION_MAX}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    );
  };

  const renderQuiz = () => {
    if (!currentQuestion) return null;
    const letters = ['A', 'B', 'C', 'D'];
    // Adaptive review question — surfaced because the user has shown
    // mastery in this path. Different visual treatment so the user
    // understands "this is from an earlier lesson, not a curveball".
    const isReviewQuestion = quizIndex >= baseQuizLength;
    // When scenarioQuiz is the active source, the step chip reads
    // "SENARYO" instead of "QUIZ" — these are application questions,
    // not recall questions.
    const quizLabel = scenarioQuiz
      ? t('lesson.scenario', 'SENARYO')
      : t('lesson.quiz', 'QUIZ');
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepChip}>
          <Text style={styles.stepChipText}>
            🧠 {quizLabel} — {quizIndex + 1}/{quiz.length}
          </Text>
        </View>
        {/* Critical hit flash — pops in when the user just rolled the
            5% crit on a correct answer. Variable-reward dopamine spike. */}
        {critFlash > 0 ? (
          <View style={styles.critFlash}>
            <Text style={styles.critFlashText}>
              {t('lesson.critHit', '⚡ CRITICAL HIT! +25 XP')}
            </Text>
          </View>
        ) : null}
        {/* Review-question badge — adaptive engine pulled this question
            from an earlier lesson in the same path (spaced repetition).
            Helps the user understand the format change. */}
        {isReviewQuestion ? (
          <View style={styles.reviewBadge}>
            <MaterialIcons name="history-edu" size={14} color="#7C3AED" />
            <Text style={styles.reviewBadgeText}>
              {t('lesson.reviewBadge', 'ÖNCEKİ DERSTEN · HATIRLAMA')}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.title, { marginTop: 16 }]}>{currentQuestion.q}</Text>
        <Text style={styles.questionSubtitle}>
          {t('lesson.quizHint', 'Doğru olduğunu düşündüğün cevabı seç.')}
        </Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = selectedAnswer === idx;
            const isCorrect = idx === currentQuestion.correct;
            const showCorrect = revealed && isCorrect;
            const showWrong = revealed && isSelected && !isCorrect;

            const cardStyle = [styles.optionCard];
            const letterBoxStyle = [styles.optionLetterBox];
            let letterColor = LT.onSurfaceVariant;

            if (showCorrect) {
              cardStyle.push({
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderColor: '#10B981',
              });
              letterBoxStyle.push({ backgroundColor: '#10B981', borderColor: '#10B981' });
              letterColor = '#FFFFFF';
            } else if (showWrong) {
              cardStyle.push({
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderColor: '#EF4444',
              });
              letterBoxStyle.push({ backgroundColor: '#EF4444', borderColor: '#EF4444' });
              letterColor = '#FFFFFF';
            } else if (isSelected) {
              cardStyle.push({
                backgroundColor: LT.surfaceContainerLowest,
                borderColor: LT.primaryContainer,
              });
              letterBoxStyle.push({ backgroundColor: LT.primaryContainer, borderColor: LT.primaryContainer });
              letterColor = LT.onPrimary;
            }

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleQuizAnswer(idx)}
                disabled={revealed}
                activeOpacity={0.85}
                style={cardStyle}
              >
                <View style={letterBoxStyle}>
                  <Text style={[styles.optionLetter, { color: letterColor }]}>
                    {letters[idx]}
                  </Text>
                </View>
                <Text style={styles.optionText}>{opt}</Text>
                {showCorrect && (
                  <MaterialIcons name="check-circle" size={22} color="#10B981" />
                )}
                {showWrong && (
                  <MaterialIcons name="cancel" size={22} color="#EF4444" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {revealed && currentQuestion.explain && (
          <View style={styles.explainBox}>
            <MaterialIcons
              name={selectedAnswer === currentQuestion.correct ? 'check-circle' : 'info'}
              size={18}
              color={selectedAnswer === currentQuestion.correct ? '#10B981' : '#FDE047'}
            />
            <Text style={styles.explainText}>{currentQuestion.explain}</Text>
          </View>
        )}

        {/* Growth-frame line on wrong answer — single quiet sentence
            reframing the miss as part of the work. Deterministic pick
            from a 12-line pool keyed by (lessonId, quizIndex) so the
            same wrong answer always shows the same line (stable —
            replays don't shuffle). Tonal: stoic, no cheerleading,
            no apology — just frame. */}
        {revealed && selectedAnswer !== currentQuestion.correct && (() => {
          const growthLines = t('lesson.growthLines', { returnObjects: true });
          if (!Array.isArray(growthLines) || growthLines.length === 0) return null;
          // Cheap deterministic string hash. Stable per (lessonId, qIdx).
          let h = 0;
          const key = `${lessonId || ''}::${quizIndex}`;
          for (let i = 0; i < key.length; i++) {
            h = (h * 31 + key.charCodeAt(i)) | 0;
          }
          const idx = Math.abs(h) % growthLines.length;
          const line = growthLines[idx];
          if (!line) return null;
          return (
            <View style={styles.growthLineBox}>
              <Text style={styles.growthLineText}>{line}</Text>
            </View>
          );
        })()}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // commitments[] (when present) replaces the single `action` checkbox.
  // User picks ONE — the picked one becomes both the displayed
  // commitment AND counts as "actionDone" for the completion CTA.
  const renderCommitmentsList = () => {
    if (!commitments) return null;
    return (
      <View style={styles.commitmentsWrap}>
        <Text style={styles.commitmentsLabel}>
          {t('lesson.commitChoose', 'BUGÜN HANGİSİNİ YAPACAKSIN?')}
        </Text>
        {commitments.map((c, idx) => {
          const isSelected = selectedCommitment === idx;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                if (alreadyCompleted) return;
                playSound('tap').catch(() => {});
                Haptics.selectionAsync().catch(() => {});
                setSelectedCommitment(isSelected ? null : idx);
                // Picking a commitment satisfies "actionDone" so the
                // bottom CTA unlocks. Unpicking re-locks it.
                setActionDone(!isSelected);
              }}
              activeOpacity={alreadyCompleted ? 1 : 0.85}
              style={[
                styles.commitmentCard,
                isSelected && styles.commitmentCardActive,
              ]}
            >
              <View
                style={[
                  styles.commitmentRadio,
                  isSelected && styles.commitmentRadioActive,
                ]}
              >
                {isSelected ? (
                  <MaterialIcons name="check" size={16} color={LT.onPrimary} />
                ) : null}
              </View>
              <Text style={styles.commitmentText}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderCommit = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stepChipTertiary}>
        <Text style={styles.stepChipTertiaryText}>
          🎯 {t('lesson.action', 'BUGÜN YAP')}
        </Text>
      </View>

      <View style={styles.commitMascotWrap}>
        <LinearGradient
          colors={[LT.surfaceContainerLowest, LT.surfaceContainerLowest]}
          style={styles.commitMascotCircle}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.commitMascotImg}
            resizeMode="contain"
          />
        </LinearGradient>
      </View>

      {commitments ? (
        renderCommitmentsList()
      ) : (
        <TouchableOpacity
          style={[
            styles.actionCard,
            (actionDone || alreadyCompleted) && styles.actionCardActive,
          ]}
          onPress={() => !alreadyCompleted && setActionDone(!actionDone)}
          activeOpacity={alreadyCompleted ? 1 : 0.8}
        >
          <View
            style={[
              styles.checkbox,
              (actionDone || alreadyCompleted) && styles.checkboxActive,
            ]}
          >
            {(actionDone || alreadyCompleted) && (
              <MaterialIcons name="check" size={18} color={LT.onPrimary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionText}>{action}</Text>
            {!alreadyCompleted && !actionDone && (
              <Text style={styles.actionHint}>
                {t('lesson.tapToCheck', 'YAPTIĞINDA İŞARETLE')}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Reflection block — when the new schema's reflectionPrompts[]
          is present, render EACH prompt as a labelled section sharing
          ONE textarea (we still only persist one reflection string —
          the prompts are guidance for the writer, not separate fields.
          Keeping the storage shape one-string also avoids touching the
          completePathLesson reducer + history pages). */}
      {reflectionPrompts && reflectionPrompts.length > 0 ? (
        <View style={styles.reflectionWrap}>
          {reflectionPrompts.map((p, i) => (
            <Text
              key={i}
              style={[
                styles.reflectionLabel,
                i > 0 && { marginTop: 8 },
              ]}
            >
              {`${i + 1}. ${p}`}
            </Text>
          ))}
          <View style={styles.reflectionBox}>
            <TextInput
              value={reflection}
              onChangeText={(txt) => setReflection(txt.slice(0, REFLECTION_MAX))}
              placeholder={t('lesson.reflectionPlaceholder', 'Düşüncelerini buraya yaz...')}
              placeholderTextColor={LT.outline}
              multiline
              style={styles.reflectionInput}
              editable={!alreadyCompleted}
            />
            <View style={styles.reflectionEditIcon} pointerEvents="none">
              <MaterialIcons name="edit-note" size={20} color={LT.outline} />
            </View>
          </View>
          <View style={styles.reflectionMeta}>
            <Text style={styles.reflectionMetaText}>
              {t('lesson.optional', 'OPSİYONEL')}
            </Text>
            <Text style={styles.reflectionMetaText}>
              {reflection.length} / {REFLECTION_MAX}
            </Text>
          </View>

          {/* Voice journal — record / play row. Stored locally. */}
          <View style={styles.voiceRow}>
            <TouchableOpacity
              onPress={handleToggleRecord}
              activeOpacity={0.85}
              style={[styles.voiceBtn, recording && styles.voiceBtnRecording]}
              disabled={alreadyCompleted}
            >
              <MaterialIcons
                name={recording ? 'stop-circle' : 'mic'}
                size={18}
                color={recording ? LT.onPrimary : LT.primary}
              />
              <Text
                style={[
                  styles.voiceBtnText,
                  recording && styles.voiceBtnTextRecording,
                ]}
              >
                {recording
                  ? t('lesson.voiceStop', 'KAYDI DURDUR')
                  : recordingUri
                  ? t('lesson.voiceReRecord', 'YENİDEN KAYDET')
                  : t('lesson.voiceRecord', 'SESLİ KAYIT')}
              </Text>
            </TouchableOpacity>
            {recordingUri && !recording ? (
              <TouchableOpacity
                onPress={handlePlayRecording}
                activeOpacity={0.85}
                style={styles.voicePlayBtn}
              >
                <MaterialIcons name="play-circle-fill" size={20} color={LT.primary} />
                <Text style={styles.voicePlayText}>
                  {t('lesson.voicePlay', 'DİNLE')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : reflectionPrompt ? (
        <View style={styles.reflectionWrap}>
          <Text style={styles.reflectionLabel}>{reflectionPrompt}</Text>
          <View style={styles.reflectionBox}>
            <TextInput
              value={reflection}
              onChangeText={(txt) => setReflection(txt.slice(0, REFLECTION_MAX))}
              placeholder={t('lesson.reflectionPlaceholder', 'Düşüncelerini buraya yaz...')}
              placeholderTextColor={LT.outline}
              multiline
              style={styles.reflectionInput}
              editable={!alreadyCompleted}
            />
            <View style={styles.reflectionEditIcon} pointerEvents="none">
              <MaterialIcons name="edit-note" size={20} color={LT.outline} />
            </View>
          </View>
          <View style={styles.reflectionMeta}>
            <Text style={styles.reflectionMetaText}>
              {t('lesson.optional', 'OPSİYONEL')}
            </Text>
            <Text style={styles.reflectionMetaText}>
              {reflection.length} / {REFLECTION_MAX}
            </Text>
          </View>

          {/* Voice journal — record / play row. Stored locally. */}
          <View style={styles.voiceRow}>
            <TouchableOpacity
              onPress={handleToggleRecord}
              activeOpacity={0.85}
              style={[styles.voiceBtn, recording && styles.voiceBtnRecording]}
              disabled={alreadyCompleted}
            >
              <MaterialIcons
                name={recording ? 'stop-circle' : 'mic'}
                size={18}
                color={recording ? LT.onPrimary : LT.primary}
              />
              <Text
                style={[
                  styles.voiceBtnText,
                  recording && styles.voiceBtnTextRecording,
                ]}
              >
                {recording
                  ? t('lesson.voiceStop', 'KAYDI DURDUR')
                  : recordingUri
                  ? t('lesson.voiceReRecord', 'YENİDEN KAYDET')
                  : t('lesson.voiceRecord', 'SESLİ KAYIT')}
              </Text>
            </TouchableOpacity>
            {recordingUri && !recording ? (
              <TouchableOpacity
                onPress={handlePlayRecording}
                activeOpacity={0.85}
                style={styles.voicePlayBtn}
              >
                <MaterialIcons name="play-circle-fill" size={20} color={LT.primary} />
                <Text style={styles.voicePlayText}>
                  {t('lesson.voicePlay', 'DİNLE')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ height: 160 }} />
    </ScrollView>
  );

  const renderBottomCTA = () => {
    if (step === STEP.HOOK) {
      return (
        <View style={styles.bottomCTAWrap}>
          <TouchableOpacity onPress={handleHookContinue} activeOpacity={0.9} style={styles.ctaShadow}>
            <LinearGradient
              colors={[LT.primaryContainer, LT.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>{t('lesson.hookContinue', 'Devam et')}</Text>
              <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }
    if (step === STEP.TEACHING) {
      return (
        <View style={styles.bottomCTAWrap}>
          <TouchableOpacity onPress={handleTeachingNext} activeOpacity={0.9} style={styles.ctaShadow}>
            <LinearGradient
              colors={[LT.primaryContainer, LT.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>{t('lesson.gotIt', 'Anladım')}</Text>
              <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }
    if (step === STEP.PRACTICE) {
      // Continue is gated until the timer either ran out OR the user
      // explicitly tapped "Atla". That way the user can't bypass the
      // exercise by tapping Continue immediately.
      const canContinue = practiceFinished;
      return (
        <View style={styles.bottomCTAWrap}>
          <TouchableOpacity
            onPress={handlePracticeContinue}
            disabled={!canContinue}
            activeOpacity={0.9}
            style={styles.ctaShadow}
          >
            <LinearGradient
              colors={
                canContinue
                  ? [LT.primaryContainer, LT.primaryContainer]
                  : [LT.surfaceContainerHigh, LT.surfaceContainerHigh]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={[styles.ctaText, !canContinue && { opacity: 0.5 }]}>
                {canContinue
                  ? t('common.continue', 'Devam')
                  : t('lesson.practiceDone', 'Tamamla')}
              </Text>
              {canContinue && (
                <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }
    if (step === STEP.QUIZ) {
      return (
        <View style={styles.bottomCTAWrap}>
          <TouchableOpacity
            onPress={handleQuizContinue}
            disabled={!revealed}
            activeOpacity={0.9}
            style={styles.ctaShadow}
          >
            <LinearGradient
              colors={revealed ? [LT.primaryContainer, LT.primaryContainer] : [LT.surfaceContainerHigh, LT.surfaceContainerHigh]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={[styles.ctaText, !revealed && { opacity: 0.5 }]}>
                {revealed
                  ? quizIndex + 1 < quiz.length
                    ? t('common.continue', 'Devam')
                    : t('common.next', 'İleri')
                  : t('lesson.selectAnswer', 'Bir cevap seç')}
              </Text>
              {revealed && <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }
    const canComplete = (actionDone || alreadyCompleted) && !completing;
    return (
      <View style={styles.bottomCTAWrap}>
        <TouchableOpacity
          onPress={handleComplete}
          disabled={!canComplete}
          activeOpacity={0.9}
          style={styles.ctaShadow}
        >
          <LinearGradient
            colors={
              alreadyCompleted
                ? ['#10B981', '#059669']
                : canComplete
                  ? [LT.primaryContainer, LT.primaryContainer]
                  : ['rgba(227, 18, 18, 0.4)', 'rgba(227, 18, 18, 0.4)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            <MaterialIcons name="check-circle" size={20} color={LT.onPrimary} />
            <Text style={[styles.ctaText, !canComplete && { opacity: 0.6 }]}>
              {alreadyCompleted
                ? t('lesson.completed', '✓ Tamamlandı')
                : t('lesson.completeLesson', '✓ Dersi tamamla')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        {!actionDone && !alreadyCompleted && (
          <Text style={styles.ctaHint}>
            {t('lesson.checkActionFirst', 'DEVAM ETMEK İÇİN GÖREVİ İŞARETLE')}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Time-aware mood tint — additive overlay, never intercepts touches.
          Children render after, so they sit above this on z-axis. */}
      {mood.tintColor && mood.tintOpacity > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: mood.tintColor,
            opacity: mood.tintOpacity,
            zIndex: 0,
          }}
        />
      ) : null}
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={[styles.glow, { top: -80, right: -60 }]} pointerEvents="none" />
        <View
          style={[styles.glow, styles.glowPurple, { bottom: -80, left: -60 }]}
          pointerEvents="none"
        />

        {renderTopBar()}

        {step === STEP.HOOK && renderHook()}
        {step === STEP.TEACHING && renderTeaching()}
        {step === STEP.PRACTICE && renderPractice()}
        {step === STEP.QUIZ && renderQuiz()}
        {step === STEP.COMMIT && renderCommit()}

        {renderBottomCTA()}

        <MilestoneModal
          visible={milestoneVisible}
          streak={milestoneStreak}
          onClose={handleMilestoneClose}
        />

        {/* Path Milestone Scene — narrative chapter break every 10
            lessons in a path. Independent of the streak-day milestone
            modal; both can fire on the same lesson but they're sequenced. */}
        <PathMilestoneScene
          visible={pathSceneVisible}
          pathId={pathId}
          stage={pathSceneStage}
          onClose={() => setPathSceneVisible(false)}
          // Stage-50 "next path" affordance — find the first uncompleted
          // path AFTER the current one and prep a navigate target. This
          // is the auto-next-path retention move (highest-leverage at
          // path completion since these are the most-engaged users at
          // their highest risk of "done, uninstall" churn).
          nextPathName={(() => {
            if (pathSceneStage !== 50) return null;
            const next = PATHS.find(
              (p) => p.id !== pathId && !isPathComplete(p, pathProgress),
            );
            if (!next) return null;
            return t(`paths.${next.id}.title`, next.id);
          })()}
          onStartNextPath={(() => {
            if (pathSceneStage !== 50) return null;
            const next = PATHS.find(
              (p) => p.id !== pathId && !isPathComplete(p, pathProgress),
            );
            if (!next) return null;
            const nextLesson = getCurrentLesson(next, pathProgress);
            if (!nextLesson) return null;
            return () => {
              setPathSceneVisible(false);
              navigation.replace('Lesson', {
                pathId: next.id,
                lessonId: nextLesson.id,
              });
            };
          })()}
        />

        {/* Sage Mode — Premium audio-guided deep session. Triggered
            from the celebration screen via the gold SAGE MODE button.
            Awards +30 XP on completion. */}
        <SageMode
          visible={sageModeVisible}
          lesson={lesson}
          teaching={teaching}
          action={action}
          onClose={() => setSageModeVisible(false)}
          onComplete={({ bonusXp }) => {
            // Credit the bonus XP via the generic GRANT_BONUS_XP
            // action. The lesson XP was already awarded when the user
            // hit "Complete" — this is on top, for completing the
            // sage session itself.
            if (bonusXp > 0) grantBonusXP(bonusXp, 'sageMode');
          }}
        />

        <OutOfHeartsModal
          visible={outOfHeartsVisible}
          refillAt={heartsRefillAt}
          onClose={() => {
            setOutOfHeartsVisible(false);
            // Bail back to PathScreen — can't continue with no hearts
            navigation.goBack();
          }}
          onRefill={() => {
            // Rewarded-ad path → +1 heart (NOT full refill). One ad,
            // one heart. Avoids the previous "watch 1 ad → 5 hearts"
            // bug that nuked the heart-economy entirely.
            earnHeart();
            setOutOfHeartsVisible(false);
          }}
          onPaywall={() => {
            setOutOfHeartsVisible(false);
            navigation.navigate('Paywall');
          }}
        />

        {/* Streak Repair (#2A retention) — only renders during celebration
            since that's when pendingStreakRestore was just populated by
            the reducer. After interaction, the field is cleared and the
            modal disappears. */}
        <StreakRepairModal
          visible={!!pendingStreakRestore && showCelebration}
          brokenStreak={pendingStreakRestore?.brokenStreak}
          expiresAt={pendingStreakRestore?.expiresAt}
          isPremium={isPremium}
          streakFreezes={streakFreezes || 0}
          rewardedReady={isRewardedReady()}
          onWatchAd={async () => {
            // Caller-side: show the rewarded ad, then restore if user
            // watched it through. If they bailed before the reward
            // event, do nothing — modal stays open so they can retry.
            const earned = await showRewarded();
            if (earned) restoreBrokenStreak({ useToken: false });
            // Preload next rewarded ad regardless (so a future repair
            // prompt is immediately actionable).
            loadRewarded().catch(() => {});
            return earned;
          }}
          onUseToken={() => restoreBrokenStreak({ useToken: true })}
          onDismiss={dismissBrokenStreakRestore}
        />

        {showCelebration && (
          <View style={styles.celebration}>
            {/* Top bar with title */}
            <View style={styles.celebrationTopBar}>
              <View style={{ width: 40 }} />
              <Text style={styles.celebrationTopTitle}>
                {t('lesson.completeTitle', 'Lesson Complete')}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Centered content */}
            <View style={styles.celebrationCenter}>
              <View style={styles.celebrationEmojiWrap} pointerEvents="none">
                <Animated.Text
                  style={[
                    styles.celebrationEmoji,
                    { transform: [{ scale: celebrationScale }] },
                  ]}
                >
                  {/* Stoic streak-band emoji. Sapling for the first day, fire
                      for the middle range where the habit is still burning
                      itself in, then onyx stone once discipline has
                      solidified. Tonal — no party here. */}
                  {(currentStreak || 0) <= 1
                    ? '🌱'
                    : (currentStreak || 0) >= 14
                      ? '🗿'
                      : '🔥'}
                </Animated.Text>
                <View style={styles.celebrationRing} />
              </View>
              <Animated.Text
                style={[
                  styles.celebrationXP,
                  { transform: [{ translateY: xpY }] },
                ]}
              >
                +{15 + correctCount * 5} XP
              </Animated.Text>
              <Text style={styles.celebrationHeading}>
                {/* 3-band celebration line keyed off streak. Acknowledges
                    the action without cheerleading — stoic register. */}
                {(currentStreak || 0) <= 1
                  ? t('lesson.celebration.start', 'Başladın.')
                  : (currentStreak || 0) <= 6
                    ? t('lesson.celebration.again', 'Bir daha.')
                    : t('lesson.celebration.persist', 'Yine geldin. Bunu unutma.')}
              </Text>
              <Text style={styles.celebrationSubtitle}>
                {t(
                  'lesson.completeFooter',
                  'Disiplin yolunda bir adım daha attın.',
                )}
              </Text>
              {/* Quiz score chip */}
              {quiz.length > 0 && (
                <View style={styles.celebrationStatPill}>
                  <MaterialIcons name="quiz" size={14} color="#10B981" />
                  <Text style={styles.celebrationStatText}>
                    {correctCount}/{quiz.length} {t('lesson.correct', 'doğru')}
                  </Text>
                </View>
              )}

              {/* Daily Goal pill — two states. Hit: celebrates the +50 XP
                  bonus we just granted in the reducer. Progress: nudges
                  the user with how many lessons are left to hit the goal.
                  _dailyGoalToast is set by COMPLETE_PATH_LESSON when this
                  completion crossed the threshold; non-null means we are
                  currently in the celebration moment for it. */}
              {_dailyGoalToast ? (
                <View style={styles.dailyGoalHitPill}>
                  <MaterialIcons name="emoji-events" size={14} color="#B45309" />
                  <Text style={styles.dailyGoalHitText}>
                    {t('lesson.dailyGoalHit', 'GÜNLÜK HEDEF · +{{bonus}} XP', {
                      bonus: _dailyGoalToast.bonus,
                    })}
                  </Text>
                </View>
              ) : dailyLessonsCount > 0 && dailyLessonsCount < dailyGoalTarget ? (
                <View style={styles.dailyGoalProgressPill}>
                  <MaterialIcons name="flag" size={14} color={LT.primaryContainer} />
                  <Text style={styles.dailyGoalProgressText}>
                    {t(
                      'lesson.dailyGoalProgress',
                      'Bugün {{current}}/{{target}} ders — {{remaining}} kaldı',
                      {
                        current: dailyLessonsCount,
                        target: dailyGoalTarget,
                        remaining: dailyGoalTarget - dailyLessonsCount,
                      },
                    )}
                  </Text>
                </View>
              ) : null}

              {/* Reflection Mirror — surfaces a curated quote that
                  echoes the user's journal entry. The app shows it
                  "heard" them. Empathy hook; the strongest single
                  retention lever for any journaling app. */}
              {mirrorQuote ? (
                <View style={styles.mirrorCard}>
                  <Text style={styles.mirrorLabel}>
                    {firstName
                      ? t('lesson.mirrorLabelPersonal', '{{name}}, A SAGE RESPONDS', { name: firstName.toUpperCase() })
                      : t('lesson.mirrorLabel', 'A SAGE RESPONDS')}
                  </Text>
                  <Text style={styles.mirrorQuote}>{mirrorQuote}</Text>
                </View>
              ) : null}

              {/* Lesson Cliffhanger — teases the title of the NEXT
                  lesson so the user closes the loop tomorrow. Curiosity
                  gap (Zeigarnik effect) is the cheapest, strongest
                  return-tomorrow hook a habit app can deploy. */}
              {(() => {
                const nextOrder = (lesson?.order || 0) + 1;
                if (!path || nextOrder > path.duration) return null;
                // Lesson titles live at lessons.<pathId>.<order>.title
                // (nested object in locale JSON), not the flat
                // lessons.<pathId-order>.title that the lesson id
                // looks like.
                const nextKey = `lessons.${path.id}.${nextOrder}.title`;
                const nextTitle = t(nextKey, '');
                if (!nextTitle || nextTitle === nextKey) {
                  return null;
                }
                return (
                  <View style={styles.cliffhanger}>
                    <Text style={styles.cliffhangerLabel}>
                      {t('lesson.tomorrowTeaser', 'TOMORROW')}
                    </Text>
                    <Text style={styles.cliffhangerTitle} numberOfLines={2}>
                      {nextTitle}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* CTA buttons */}
            <View style={styles.celebrationCTAs}>
              {/* Sage Mode — premium-only deep session entry. Visible
                  to all so free users see the perk; tapping opens
                  paywall for free, opens SageMode modal for premium. */}
              <TouchableOpacity
                onPress={() => {
                  if (!isPremium) {
                    navigation.navigate('Paywall');
                  } else {
                    setSageModeVisible(true);
                  }
                }}
                activeOpacity={0.85}
                style={styles.sageBtn}
              >
                <MaterialIcons name="self-improvement" size={18} color="#FDE047" />
                <Text style={styles.sageBtnText}>
                  {t('sage.openCta', 'SAGE MODE · DEEP SESSION')}
                </Text>
                {!isPremium ? (
                  <MaterialIcons name="lock" size={14} color="#FDE047" />
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNextLesson}
                activeOpacity={0.9}
                style={styles.celebrationPrimaryShadow}
              >
                <LinearGradient
                  colors={[LT.primaryContainer, LT.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.celebrationPrimaryBtn}
                >
                  <Text style={styles.celebrationPrimaryText}>
                    {t('lesson.nextLesson', 'Sonraki Dersi Başla')}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCelebrationContinue}
                activeOpacity={0.7}
                style={styles.celebrationSecondaryBtn}
              >
                <Text style={styles.celebrationSecondaryText}>
                  {t('lesson.backToPath', 'Yola Dön')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  container: { flex: 1, backgroundColor: LT.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: LT.onSurface, fontSize: 16 },
  backText: { color: LT.primaryContainer, fontSize: 16 },

  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(227, 18, 18, 0.05)',
    opacity: 0.6,
  },
  glowPurple: { backgroundColor: 'rgba(55, 65, 225, 0.04)' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    flex: 1, height: 8,
    backgroundColor: LT.surfaceContainerHigh,
    borderRadius: 4, overflow: 'hidden',
  },
  progressFillWrap: { height: '100%', borderRadius: 4 },
  progressFill: {
    flex: 1, borderRadius: 4,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8,
  },
  heartsBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: LT.outlineVariant, gap: 4,
  },
  heartsText: { color: LT.primaryContainer, fontSize: 13, fontWeight: '800' },

  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  stepLabel: {
    color: LT.primaryContainer,
    fontSize: 12, fontWeight: '900',
    letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 8,
  },
  stepChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderColor: 'rgba(227, 18, 18, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  stepChipText: {
    color: LT.primaryContainer,
    fontSize: 11, fontWeight: '900',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  // Critical hit flash banner — popped when the user lucks into the
  // 5% crit on a correct quiz answer. Gold/yellow accent so it reads
  // as "rare". Auto-clears via setTimeout in handleQuizAnswer.
  critFlash: {
    marginTop: 12,
    backgroundColor: '#FDE047',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  critFlashText: {
    color: '#7C2D12',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  // Adaptive review-question badge — purple to differentiate from the
  // crit-hit flash (gold) and the normal quiz progress chip.
  reviewBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.10)',
    borderColor: 'rgba(124, 58, 237, 0.35)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  reviewBadgeText: {
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  // Cliffhanger — small teaser card on the celebration screen showing
  // tomorrow's lesson title. Drives curiosity-gap return: "what does
  // that mean?" → user opens the app tomorrow to find out.
  cliffhanger: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLow,
    alignSelf: 'stretch',
  },
  cliffhangerLabel: {
    color: LT.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  cliffhangerTitle: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.2,
  },
  // Reflection Mirror — sage-quote card surfaced on celebration screen
  // after a user submits a reflection. Empathy hook.
  mirrorCard: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    alignSelf: 'stretch',
  },
  mirrorLabel: {
    color: '#7C3AED',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  mirrorQuote: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  // Sage Mode button — premium-exclusive entry on celebration screen.
  // Gold-tinted, sits above the "Next Lesson" CTA so it's visible but
  // not the primary action.
  sageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(253, 224, 71, 0.12)',
    borderWidth: 1.5,
    borderColor: '#FDE047',
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  sageBtnText: {
    color: '#7C2D12',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  stepChipTertiary: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217, 119, 33, 0.1)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, marginBottom: 24,
  },
  stepChipTertiaryText: {
    color: '#FFB783',
    fontSize: 11, fontWeight: '900',
    letterSpacing: 2, textTransform: 'uppercase',
  },

  title: {
    color: LT.onSurface, fontSize: 24, fontWeight: '900',
    marginBottom: 24, lineHeight: 30, letterSpacing: -0.4,
  },

  heroBox: {
    width: '100%', aspectRatio: 1,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1, borderColor: LT.outlineVariant,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  heroMascot: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 2, borderColor: 'rgba(227, 18, 18, 0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  teachingCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: LT.outlineVariant,
    overflow: 'hidden',
  },
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: LT.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 12,
  },
  speakBtnText: {
    color: LT.onPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cornerAccent: {
    position: 'absolute', top: 0, right: 0,
    width: 64, height: 64,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 64,
    borderTopWidth: 1, borderRightWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
    backgroundColor: 'rgba(227, 18, 18, 0.05)',
  },
  teachingText: {
    color: LT.onSurface, fontSize: 15,
    lineHeight: 24, fontWeight: '500',
  },

  proTipBox: {
    flexDirection: 'row',
    backgroundColor: LT.surfaceContainerLowest,
    borderLeftWidth: 4, borderLeftColor: '#FDE047',
    borderRadius: 12, padding: 16, marginTop: 24,
    gap: 12, alignItems: 'flex-start',
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderTopColor: LT.outlineVariant,
    borderRightColor: LT.outlineVariant,
    borderBottomColor: LT.outlineVariant,
  },
  proTipLabel: {
    color: '#B45309', fontSize: 11, fontWeight: '900',
    letterSpacing: 1.5, marginBottom: 4,
  },
  proTipBody: {
    color: LT.onSurfaceVariant, fontSize: 13,
    lineHeight: 18, fontWeight: '500',
  },

  questionSubtitle: {
    color: LT.onSurfaceVariant, fontSize: 14,
    marginTop: -16, marginBottom: 20,
    fontWeight: '500', lineHeight: 20,
  },
  optionsContainer: { gap: 12 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 2, borderColor: LT.outlineVariant,
    borderRadius: 18, padding: 14, gap: 14,
  },
  optionLetterBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1, borderColor: LT.outlineVariant,
  },
  optionLetter: { fontSize: 16, fontWeight: '900' },
  optionText: { flex: 1, color: LT.onSurface, fontSize: 15, fontWeight: '600' },

  explainBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: LT.outlineVariant,
  },
  explainText: {
    flex: 1, color: LT.onSurface,
    fontSize: 13, lineHeight: 20, fontStyle: 'italic',
  },
  // Growth-frame line under the explain box on a wrong answer. Quiet
  // type — smaller, muted, no icon, no background fill. Intentionally
  // visually subordinate to the explainBox so it reads as a closing
  // thought, not a second piece of information to parse.
  growthLineBox: {
    marginTop: 10,
    paddingHorizontal: 14,
  },
  growthLineText: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'left',
  },

  commitMascotWrap: { alignItems: 'center', marginBottom: 24 },
  commitMascotCircle: {
    width: 192, height: 192, borderRadius: 96,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: LT.outlineVariant,
    overflow: 'hidden',
  },
  commitMascotImg: { width: 132, height: 132, opacity: 0.9 },

  actionCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1, borderColor: 'rgba(227, 18, 18, 0.3)',
    borderRadius: 18, padding: 16, marginBottom: 24,
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
  },
  actionCardActive: {
    borderColor: LT.primaryContainer,
    backgroundColor: 'rgba(227, 18, 18, 0.06)',
  },
  checkbox: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 2, borderColor: LT.outlineVariant,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: LT.primaryContainer, borderColor: LT.primaryContainer,
  },
  actionText: { color: LT.onSurface, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  actionHint: {
    color: LT.outline,
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: 8,
  },

  reflectionWrap: { gap: 8 },
  reflectionLabel: {
    color: LT.primaryContainer,
    fontSize: 13, fontWeight: '600',
    fontStyle: 'italic', paddingHorizontal: 4,
  },
  reflectionBox: { position: 'relative' },
  reflectionInput: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1, borderColor: LT.outlineVariant,
    borderRadius: 12, padding: 14, paddingRight: 40,
    color: LT.onSurface, fontSize: 14,
    minHeight: 100, textAlignVertical: 'top',
  },
  reflectionEditIcon: { position: 'absolute', bottom: 10, right: 10 },
  reflectionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  reflectionMetaText: {
    color: LT.outline, fontSize: 10, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  voiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  voiceBtnRecording: {
    backgroundColor: LT.primary,
    borderColor: LT.primary,
  },
  voiceBtnText: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  voiceBtnTextRecording: {
    color: LT.onPrimary,
  },
  voicePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voicePlayText: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  bottomCTAWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12,
    backgroundColor: 'rgba(249, 249, 249, 0.95)',
  },
  ctaShadow: {
    borderRadius: 18,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 20,
    elevation: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 18, gap: 8,
  },
  ctaText: {
    color: LT.onPrimary,
    fontSize: 16, fontWeight: '800', letterSpacing: 0.3,
  },
  ctaHint: {
    color: LT.outline, fontSize: 10, fontWeight: '700',
    letterSpacing: 2, textAlign: 'center',
    textTransform: 'uppercase', marginTop: 12,
  },

  celebration: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: LT.background,
    zIndex: 999,
  },
  celebrationTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
    backgroundColor: LT.background,
  },
  celebrationTopTitle: {
    color: LT.onSurface, fontSize: 17, fontWeight: '700',
  },
  celebrationCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  celebrationEmojiWrap: {
    position: 'relative',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationEmoji: {
    fontSize: 120,
    textShadowColor: 'rgba(245, 158, 11, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
  },
  celebrationRing: {
    position: 'absolute',
    width: 180, height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
  },
  celebrationXP: {
    color: '#B45309',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(253, 224, 71, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 8,
  },
  celebrationHeading: {
    color: LT.onSurface,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  celebrationSubtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 20,
  },
  celebrationStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  celebrationStatText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  // Daily goal pills — paired with celebrationStatPill above so all three
  // chips line up visually on the celebration screen.
  dailyGoalHitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7', // amber-100
    borderColor: '#FCD34D', // amber-300
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  dailyGoalHitText: {
    color: '#B45309', // amber-700
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dailyGoalProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LT.surfaceContainerLowest,
    borderColor: LT.surfaceContainerHigh,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  dailyGoalProgressText: {
    color: LT.onSurface,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  celebrationCTAs: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 10,
  },
  celebrationPrimaryShadow: {
    borderRadius: 18,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  celebrationPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 18,
  },
  celebrationPrimaryText: {
    color: LT.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  celebrationSecondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  celebrationSecondaryText: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '700',
  },

  // ============================================================
  // NEW SCHEMA STYLES — Hook / Practice / Commitments
  // ============================================================

  // HOOK step — single bold scenario card. Larger type than the
  // standard teaching card so the user feels "stopped" by it.
  hookCard: {
    marginTop: 12,
    paddingVertical: 24,
    paddingHorizontal: 22,
    backgroundColor: LT.surfaceContainerLowest,
    borderLeftWidth: 4,
    borderLeftColor: LT.primaryContainer,
    borderRadius: 14,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: LT.outlineVariant,
    borderRightColor: LT.outlineVariant,
    borderBottomColor: LT.outlineVariant,
  },
  hookText: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.2,
  },

  // PRACTICE step — instruction card + timer block + skip/start CTAs.
  practiceInstructionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  practiceInstructionText: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
  },
  practiceTimerWrap: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  practiceTimerNumber: {
    color: LT.primaryContainer,
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 88,
    fontVariant: ['tabular-nums'],
  },
  practiceTimerUnit: {
    color: LT.onSurfaceVariant,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  practiceTimerTrack: {
    width: '100%',
    height: 8,
    marginTop: 16,
    backgroundColor: LT.surfaceContainerHigh,
    borderRadius: 4,
    overflow: 'hidden',
  },
  practiceTimerFill: {
    height: '100%',
    backgroundColor: LT.primaryContainer,
    borderRadius: 4,
  },
  practiceStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primaryContainer,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  practiceStartBtnText: {
    color: LT.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  practiceSkipBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  practiceSkipBtnText: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  practicePromptWrap: {
    marginTop: 8,
    gap: 8,
  },
  practicePromptLabel: {
    color: LT.primaryContainer,
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    lineHeight: 20,
    paddingHorizontal: 4,
  },

  // Commitments list — 3 radio-style cards, pick one.
  commitmentsWrap: {
    gap: 10,
    marginBottom: 24,
  },
  commitmentsLabel: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  commitmentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    borderRadius: 16,
    padding: 16,
  },
  commitmentCardActive: {
    borderColor: LT.primaryContainer,
    backgroundColor: 'rgba(227, 18, 18, 0.06)',
  },
  commitmentRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  commitmentRadioActive: {
    backgroundColor: LT.primaryContainer,
    borderColor: LT.primaryContainer,
  },
  commitmentText: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
