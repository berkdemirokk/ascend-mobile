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
import { getPathById, getLessonById, getQuizForLesson } from '../data/paths';
import { showInterstitial, shouldShowAd } from '../services/ads';
import MilestoneModal, { isMilestone } from '../components/MilestoneModal';
import ConfettiBurst from '../components/ConfettiBurst';
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
import { requestReviewIfAppropriate } from '../services/review';
import { cancelFirstWeekHooks } from '../services/notifications';
import { maybeTriggerPostLessonPaywall } from '../services/paywallTrigger';
import { mirrorReflection } from '../services/reflectionMirror';
import { shouldShowLetter, getLetterFor } from '../services/futureLetter';
import FutureLetterModal from '../components/FutureLetterModal';
import { track } from '../services/analytics';
import { useAuth } from '../contexts/AuthContext';
import { LT, LT_RADIUS } from '../config/lightTheme';

const STEP = {
  TEACHING: 'teaching',
  QUIZ: 'quiz',
  COMMIT: 'commit',
};

const REFLECTION_MAX = 250;

export default function LessonScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { user } = useAuth();
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
    userProfile,
    lastLetterShownAt,
    recordFutureLetterShown,
    baselineAssessment,
    todaySessionLessons,
    _momentumToast,
    clearMomentumToast,
  } = useApp();

  // Compute the bonus the user would earn IF they tap "Sıradakini" now.
  // We base it on the count AFTER this just-finished lesson because the
  // reducer has already incremented todaySessionLessons. So the next
  // lesson would be (todaySessionLessons + 1) in chain order — bonus
  // schedule: 2→+25, 3→+50, 4→+75, 5+→+100.
  const nextChainBonus = useMemo(() => {
    const next = (todaySessionLessons || 0) + 1;
    if (next === 2) return 25;
    if (next === 3) return 50;
    if (next === 4) return 75;
    if (next >= 5) return 100;
    return 0;
  }, [todaySessionLessons]);

  const path = useMemo(() => getPathById(pathId), [pathId]);
  const lesson = useMemo(() => getLessonById(lessonId), [lessonId]);
  const quiz = useMemo(
    () => (path && lesson ? getQuizForLesson(t, pathId, lesson.order) : []),
    [path, lesson, pathId, t],
  );

  const [step, setStep] = useState(STEP.TEACHING);
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const [reflection, setReflection] = useState('');
  const [actionDone, setActionDone] = useState(false);
  const [completing, setCompleting] = useState(false);
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
  // "Letter from Future Self" — variable-reward surface that fires on
  // a small percentage of completions, gated by a 7-day cooldown.
  // Populated by handleCelebrationContinue right before exit, blocks
  // the normal post-lesson sequence until dismissed.
  const [letterModalVisible, setLetterModalVisible] = useState(false);
  const [currentLetter, setCurrentLetter] = useState(null);
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
    // Funnel event — user opened a lesson. Compared against
    // `lesson_completed` this gives us the per-lesson abandonment rate.
    track({
      event: 'lesson_started',
      userId: user?.id,
      props: { pathId, lessonId, lessonOrder: lesson?.order || null },
    });
    return () => {
      mountedRef.current = false;
      ttsStop().catch(() => {});
    };
    // We intentionally only want this event ONCE on mount, even if user
    // / route changes mid-screen, so deps are empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Pass the lesson coordinates so tts.js can attempt the
      // pre-recorded Piper MP3 from the GitHub release. Falls back
      // to system TTS automatically if that MP3 isn't available.
      pathId,
      lessonOrder: lesson?.order,
      onDone: () => safeSet(setIsSpeaking)(false),
      onError: () => safeSet(setIsSpeaking)(false),
    });
    if (!ok) safeSet(setIsSpeaking)(false);
  };

  // Heart refill countdown is now handled by LiveCountdown inside
  // OutOfHeartsModal — passing `refillAt={heartsRefillAt}` makes the
  // modal tick down to zero on its own each second. The old local
  // `now` state + every-30s setInterval was redundant.

  const alreadyCompleted = pathProgress?.[pathId]?.completed?.includes(lessonId);

  // Mount-time hearts guard: if a free user lands on a Lesson with 0
  // hearts (e.g. tapped Home "next lesson" card, deep-linked from
  // notification), bounce them out IMMEDIATELY with the OutOfHearts
  // modal. Skipped during the new-user grace period because hearts
  // aren't being consumed there anyway.
  //
  // NOTE: `alreadyCompleted` is declared *above* this effect on purpose —
  // it used to be declared below, creating a TDZ ordering risk where the
  // mount-time read of `alreadyCompleted` happened before its `const`
  // binding was initialized. Refactor-safe order: derive value first,
  // then reference it from the effect.
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

  // Auto-clear the momentum toast after the celebration has had time
  // to surface it. Without this, navigating back to a previously-
  // completed lesson would still show the stale chain badge.
  useEffect(() => {
    if (!_momentumToast) return;
    const id = setTimeout(() => clearMomentumToast(), 5000);
    return () => clearTimeout(id);
  }, [_momentumToast, clearMomentumToast]);

  // When the user navigates to a different lesson via navigation.replace
  // (e.g. "Sıradakini de yap" → next lesson same screen instance), React
  // Native keeps the SAME screen component mounted — only `route.params`
  // changes. Without resetting per-lesson state, page-3 of lesson N
  // would show as page-1 of lesson N+1, or worse: `completing=true`
  // would persist and PERMANENTLY disable the Complete button on the
  // next lesson (the user's primary complaint: "tamamlandı basılmıyo").
  //
  // We deliberately reset ONLY per-lesson UI/quiz state — global app
  // context (XP, streak, pathProgress) belongs in AppContext and is
  // not touched here. The `mountedRef` is NOT reset; it's tied to
  // the actual component lifecycle, not the lesson swap.
  useEffect(() => {
    setStep(STEP.TEACHING);
    setTeachingPageIdx(0);
    setQuizIndex(0);
    setSelectedAnswer(null);
    setRevealed(false);
    setCorrectCount(0);
    setReflection('');
    setActionDone(false);
    setCompleting(false);              // ← the dead-button cause
    setShowCelebration(false);
    setMilestoneVisible(false);
    setMilestoneStreak(0);
    setPathSceneVisible(false);
    setPathSceneStage(0);
    setSageModeVisible(false);
    setOutOfHeartsVisible(false);
    setCritBonusXP(0);
    setCritFlash(0);
    setMirrorQuote(null);
    setLetterModalVisible(false);
    setCurrentLetter(null);
    setRecording(false);
    setRecordingUri(null);
    // Reset celebration scale + xpY refs so the next lesson's
    // celebration animation starts from its base instead of the prior
    // lesson's end state.
    try {
      celebrationScale.setValue(0);
      xpY.setValue(0);
    } catch {}
    // Reset the post-letter run guard so next lesson can fire it once.
    postLetterFlowRanRef.current = false;
  }, [lessonId]);

  useEffect(() => {
    let target = 0.33;
    if (step === STEP.QUIZ) target = 0.66;
    else if (step === STEP.COMMIT) target = 1.0;
    Animated.timing(stepProgress, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, stepProgress]);

  // NOTE: All hooks below MUST run unconditionally on every render —
  // React's Rules of Hooks. The early `if (!path || !lesson) return`
  // guard used to live HERE (between hooks) which caused a
  // hook-count mismatch on the rare-but-possible "lesson missing"
  // path. Now we compute everything first (using safe fallbacks when
  // lesson is null), then short-circuit-render the error state at
  // the bottom. State hook count stays constant.
  const i18nBase = lesson ? `lessons.${pathId}.${lesson.order}` : '';
  const title = lesson
    ? t(`${i18nBase}.title`, `${lesson.order}`)
    : '';
  const teaching = lesson ? t(`${i18nBase}.teaching`, '') : '';
  const action = lesson ? t(`${i18nBase}.action`, '') : '';
  const reflectionPrompt = lesson
    ? t(`${i18nBase}.reflectionPrompt`, '')
    : '';
  const proTipKey = lesson ? `${i18nBase}.proTip` : '';
  const proTipRaw = lesson ? t(proTipKey, '') : '';
  const proTip =
    proTipRaw && proTipRaw !== proTipKey ? proTipRaw : '';
  const hasQuiz = quiz.length > 0;
  const currentQuestion = hasQuiz ? quiz[quizIndex] : null;

  // ── Teaching page splitter ────────────────────────────────────────
  // Every lesson in lessons.tr.json is authored in the 4-layer
  // format (sahne → bilim → mekanizma → pratik) with paragraphs
  // separated by `\n\n`. We split on those separators so each
  // paragraph renders as its own card. Lessons authored before the
  // expansion (shorter, one-paragraph) gracefully collapse to a
  // single page. Always safe — empty teaching → empty array.
  const teachingPages = useMemo(() => {
    if (!teaching) return [];
    return teaching
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [teaching]);
  const [teachingPageIdx, setTeachingPageIdx] = useState(0);
  const isLastTeachingPage =
    teachingPageIdx >= Math.max(0, teachingPages.length - 1);

  // ── Error early-return AFTER all hooks have run ──
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

  // Teaching page advance — paginates through teachingPages first,
  // then promotes to QUIZ (or COMMIT if no quiz).
  const handleTeachingNext = () => {
    playSound('tap').catch(() => {});
    if (!isLastTeachingPage) {
      setTeachingPageIdx((i) => i + 1);
      return;
    }
    if (hasQuiz) setStep(STEP.QUIZ);
    else setStep(STEP.COMMIT);
  };

  // Optional: go back one teaching page. Only enabled past page 0.
  // Going back from page 0 would do nothing — the back-arrow in the
  // top bar already covers "leave lesson entirely".
  const handleTeachingBack = () => {
    if (teachingPageIdx <= 0) return;
    playSound('tap').catch(() => {});
    setTeachingPageIdx((i) => Math.max(0, i - 1));
  };

  const handleQuizAnswer = (idx) => {
    if (revealed) return;
    setSelectedAnswer(idx);
    setRevealed(true);
    const isCorrect = idx === currentQuestion.correct;
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
    else setStep(STEP.COMMIT);
  };

  const handleComplete = async () => {
    if (completing) return;
    // Re-tapping the green "✓ Tamamlandı" CTA on an already-finished
    // lesson used to silently return (dead button). Now: behave as
    // "go back / next" — the user pressed a button, they should see
    // something happen. Navigate back to where they came from (the
    // PathScreen reorders to highlight the next lesson, or HomeScreen
    // surfaces the next CTA). No XP grant, no re-dispatch.
    if (alreadyCompleted) {
      try {
        navigation.goBack();
      } catch {}
      return;
    }
    setCompleting(true);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playSound('complete').catch(() => {});
    } catch {}

    // Reflection Mirror — if the user wrote anything, pick a matching
    // quote from our curated library and surface it on the celebration
    // screen. Empathy hook: the app "heard" them. Fire-and-forget;
    // pure local logic, no async.
    const trimmedReflection = reflection.trim();
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
      reflection: reflection.trim(),
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

    // Funnel event — activation moment. Compared against `lesson_started`
    // this gives in-lesson dropout. Compared against `onboarding_completed`
    // this gives the activation rate (the single most important early
    // funnel metric).
    track({
      event: 'lesson_completed',
      userId: user?.id,
      props: {
        pathId,
        lessonId,
        lessonOrder: lesson?.order || null,
        quizCorrect: correctCount,
        quizTotal: quiz.length,
        wroteReflection: !!trimmedReflection,
      },
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

  // Wrapper for the celebration's "continue" button. Decides whether
  // the rare Letter from Future Self fires for this completion. If it
  // does, we show the modal and DEFER the rest of the post-lesson
  // sequence (ATT, paywall, ad, goBack) until the user dismisses the
  // letter — otherwise the letter would compete with a paywall or ad
  // for the user's attention at the worst possible moment.
  const handleCelebrationContinue = async () => {
    const totalCompleted = Object.values(pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    ) + 1;

    if (
      shouldShowLetter({
        lastLetterShownAt: lastLetterShownAt || 0,
        lessonsCompleted: totalCompleted,
      })
    ) {
      const letter = getLetterFor(userProfile?.archetype);
      setCurrentLetter(letter);
      setLetterModalVisible(true);
      recordFutureLetterShown();
      // Bail out here. The modal's onClose calls runPostLetterFlow()
      // which is the original post-lesson sequence.
      return;
    }
    return runPostLetterFlow();
  };

  // Guard: runPostLetterFlow can be invoked from two paths —
  //   (a) handleCelebrationContinue when no letter fires
  //   (b) FutureLetterModal's onClose after the user dismisses
  // If the user backgrounds the app between (a)'s decision and (b)'s
  // dismissal, both can fire and we'd double-navigate / double-paywall.
  // Track first run with a ref; subsequent calls become no-ops.
  const postLetterFlowRanRef = useRef(false);
  const runPostLetterFlow = async () => {
    if (postLetterFlowRanRef.current) return;
    postLetterFlowRanRef.current = true;
    const totalCompleted = Object.values(pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    ) + 1; // +1 for the lesson just finished

    // First-lesson side effects: activate the user (cancel "are you
    // coming back?" pushes scheduled at onboarding) but DO NOT prompt
    // for tracking here — `requestTrackingPermissionIfNeeded` already
    // ran at onboarding's end (OnboardingScreen.js) and the iOS ATT
    // API only ever shows the system sheet once anyway. Re-calling it
    // here just added another async tick to the post-celebration
    // sequence for zero user-facing benefit.
    if (totalCompleted === 1) {
      cancelFirstWeekHooks().catch(() => {});
      // BASELINE ASSESSMENT prompt — moved out of onboarding (D0 churn
      // fix). The user has now felt one full lesson and the 'measure
      // my starting point so we can show how far you came in 30 days'
      // framing has real weight. Only show if no baseline exists yet
      // (returning users from older versions might already have one).
      if (!baselineAssessment) {
        // Defer a tick so the celebration animation finishes before
        // we hard-replace the screen — feels less like a hijack.
        setTimeout(() => {
          try {
            navigation.replace('Assessment', { mode: 'baseline' });
          } catch {}
        }, 250);
        return;
      }
    }

    // Store review prompt — gated to >= 3 lessons, >= 2 streak, 24h
    // since last. No-op on lesson #1, so it's free to call.
    requestReviewIfAppropriate({
      lessonsCompleted: totalCompleted,
      streak: currentStreak + 1,
    }).catch(() => {});

    // Peak-emotional-moment paywall — fires exactly at lesson #3 for
    // free users (POST_LESSON_PAYWALL_TRIGGER_COUNT). One-shot.
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

    // Interstitial ad before exit. Suppressed for the first 3 lessons
    // even if `shouldShowAd` says yes: a brand-new user who just
    // finished their FIRST discipline lesson and immediately gets an
    // ad in the face is the textbook D1 churn moment. Let them feel
    // the win first; revenue can wait two more sessions.
    const NO_AD_GRACE_LESSONS = 3;
    if (!isPremium && totalCompleted > NO_AD_GRACE_LESSONS && shouldShowAd(false)) {
      try { await showInterstitial(); } catch {}
    }
    navigation.goBack();
  };

  const handleNextLesson = async () => {
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

  const renderTeaching = () => {
    // Per-page label maps to the 4-layer authoring format the
    // content is already written in:
    //   page 0 → "Sahne" (scene-setting paragraph)
    //   page 1 → "Bilim" (research citation)
    //   page 2 → "Mekanizma" (why it works)
    //   page 3 → "Pratik" (how to apply)
    // Lessons that have fewer paragraphs fall through to the
    // generic ÖĞRETİM label so the UI never shows a misleading
    // "Mekanizma" label on a page that doesn't have that content.
    const pageLabels = [
      `📖 ${t('lesson.teachingPage0', 'SAHNE')}`,
      `🔬 ${t('lesson.teachingPage1', 'BİLİM')}`,
      `⚙️ ${t('lesson.teachingPage2', 'MEKANİZMA')}`,
      `🎯 ${t('lesson.teachingPage3', 'PRATİK')}`,
    ];
    const totalPages = Math.max(teachingPages.length, 1);
    const pageLabel =
      teachingPages.length >= 3
        ? pageLabels[teachingPageIdx] ||
          `📖 ${t('lesson.teaching', 'ÖĞRETİM')}`
        : `📖 ${t('lesson.teaching', 'ÖĞRETİM')}`;
    const currentParagraph =
      teachingPages[teachingPageIdx] || teaching || '';

    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Per-page step label */}
        <View style={styles.teachingPageHeader}>
          <Text style={styles.stepLabel}>{pageLabel}</Text>
          {totalPages > 1 ? (
            <Text style={styles.teachingPageCount}>
              {teachingPageIdx + 1}/{totalPages}
            </Text>
          ) : null}
        </View>
        {/* Title only on the first page so subsequent pages feel
            like "next slide" not "new lesson". */}
        {teachingPageIdx === 0 ? <Text style={styles.title}>{title}</Text> : null}

        {/* Progress bar — thin red bar across the top of the card.
            Visual reassurance about how many pages are left. */}
        {totalPages > 1 ? (
          <View style={styles.teachingProgressTrack}>
            <View
              style={[
                styles.teachingProgressFill,
                {
                  width: `${((teachingPageIdx + 1) / totalPages) * 100}%`,
                },
              ]}
            />
          </View>
        ) : null}

        {/* Hero illustration only on page 0 to keep subsequent
            cards content-dense and quick to scan. */}
        {teachingPageIdx === 0 ? (
          <View style={styles.heroBox}>
            <LinearGradient
              colors={[LT.surfaceContainerLowest, LT.surfaceContainerLowest]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroMascot}>
              <MaterialIcons
                name="self-improvement"
                size={68}
                color={LT.primaryContainer}
              />
            </View>
          </View>
        ) : null}

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
          <Text style={styles.teachingText}>{currentParagraph}</Text>
        </View>

        {/* ProTip — only on the last teaching page so it punctuates
            the section, not every page. */}
        {proTip && isLastTeachingPage ? (
          <View style={styles.proTipBox}>
            <MaterialIcons name="lightbulb" size={22} color="#FDE047" />
            <View style={{ flex: 1 }}>
              <Text style={styles.proTipLabel}>{t('lesson.proTip', 'PRO İPUCU')}</Text>
              <Text style={styles.proTipBody}>{proTip}</Text>
            </View>
          </View>
        ) : null}

        {/* Back link — appears past page 0. Lets the user re-read
            a previous card without leaving the lesson. */}
        {teachingPageIdx > 0 ? (
          <TouchableOpacity
            onPress={handleTeachingBack}
            style={styles.teachingBackLink}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="arrow-back"
              size={16}
              color={LT.onSurfaceVariant}
            />
            <Text style={styles.teachingBackText}>
              {t('lesson.previousPage', 'Önceki sayfa')}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderQuiz = () => {
    if (!currentQuestion) return null;
    const letters = ['A', 'B', 'C', 'D'];
    return (
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepChip}>
          <Text style={styles.stepChipText}>
            🧠 {t('lesson.quiz', 'QUIZ')} — {quizIndex + 1}/{quiz.length}
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

        {/* Explain box — surfaced after the user picks an answer. Now
            visually louder (was italic + small + low contrast, looked
            like a footnote). User feedback: "they solve the test but
            the point is unclear." If the lesson author wrote an
            `explain`, we now SHOW it as a proper answer key, not as a
            whisper. Label varies on correctness so the user can tell
            "I got it right because X" vs. "Here's why the answer is Y." */}
        {revealed && currentQuestion.explain && (
          <View
            style={[
              styles.explainBox,
              selectedAnswer === currentQuestion.correct
                ? styles.explainBoxCorrect
                : styles.explainBoxLearn,
            ]}
          >
            <View style={styles.explainHeader}>
              <MaterialIcons
                name={
                  selectedAnswer === currentQuestion.correct
                    ? 'check-circle'
                    : 'lightbulb'
                }
                size={18}
                color={
                  selectedAnswer === currentQuestion.correct
                    ? '#10B981'
                    : LT.primaryContainer
                }
              />
              <Text
                style={[
                  styles.explainLabel,
                  selectedAnswer === currentQuestion.correct
                    ? styles.explainLabelCorrect
                    : styles.explainLabelLearn,
                ]}
              >
                {selectedAnswer === currentQuestion.correct
                  ? t('lesson.explainCorrect', 'NEDEN DOĞRU')
                  : t('lesson.explainWrong', 'AÇIKLAMA')}
              </Text>
            </View>
            <Text style={styles.explainText}>{currentQuestion.explain}</Text>

            {/* DEPTH PASS — the audit's "quiz asks but doesn't teach"
                finding. After the short `explain` we add two
                AUTOMATIC depth surfaces, derived from existing lesson
                content (no new authoring required for the 250-lesson
                library):

                1. KONTEKST — first sentence of the Bilim paragraph
                   (teachingPages[1]), which holds the research
                   citation. Reminds the user WHY this answer matters
                   beyond the local quiz, anchoring it to the lesson's
                   evidence base.

                2. NASIL UYGULA — proTip (existing field). The user
                   already saw it on the last teaching page; surfacing
                   it again right after they engaged with the quiz
                   creates spaced repetition for free.

                Both surfaces are conditional — empty content means
                the section just doesn't render, no awkward labels. */}
            {teachingPages[1] ? (
              <View style={styles.quizDepthSection}>
                <Text style={styles.quizDepthHeader}>
                  📚 {t('lesson.depthContext', 'KONUYA BAĞLAM')}
                </Text>
                <Text style={styles.quizDepthBody}>
                  {(() => {
                    const sci = teachingPages[1] || '';
                    const firstSentence = sci
                      .split(/(?<=[.!?])\s+/)
                      .filter((s) => s.length > 20)[0];
                    return firstSentence || sci.slice(0, 200);
                  })()}
                </Text>
              </View>
            ) : null}

            {proTip ? (
              <View style={styles.quizDepthSection}>
                <Text style={styles.quizDepthHeader}>
                  💡 {t('lesson.depthApply', 'NASIL UYGULA')}
                </Text>
                <Text style={styles.quizDepthBody}>{proTip}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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

      {reflectionPrompt ? (
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
    if (step === STEP.TEACHING) {
      // Label changes between mid-pages and the final page:
      //   mid:   "Sonraki" — keeps momentum, doesn't imply commitment
      //   final: "Quizi başlat" (if quiz) / "Anladım" (no quiz)
      // The mid label is intentionally not "Anladım" because we don't
      // want the user to feel like each page is a separate test.
      const midLabel = t('lesson.nextPage', 'Sonraki');
      const finalLabel = hasQuiz
        ? t('lesson.startQuiz', 'Quizi başlat')
        : t('lesson.gotIt', 'Anladım');
      return (
        <View style={styles.bottomCTAWrap}>
          <TouchableOpacity onPress={handleTeachingNext} activeOpacity={0.9} style={styles.ctaShadow}>
            <LinearGradient
              colors={[LT.primaryContainer, LT.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>
                {isLastTeachingPage ? finalLabel : midLabel}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
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
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={[styles.glow, { top: -80, right: -60 }]} pointerEvents="none" />
        <View
          style={[styles.glow, styles.glowPurple, { bottom: -80, left: -60 }]}
          pointerEvents="none"
        />

        {renderTopBar()}

        {step === STEP.TEACHING && renderTeaching()}
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
            refillHearts();
            setOutOfHeartsVisible(false);
          }}
          onPaywall={() => {
            setOutOfHeartsVisible(false);
            navigation.navigate('Paywall');
          }}
        />

        {/* Letter from Future Self — variable-reward surface. Renders
            after lesson completion in ~5% of cases (gated by cooldown
            in shouldShowLetter). Blocks the rest of the post-lesson
            sequence until dismissed; on close we continue into the
            normal flow (ATT/review/paywall/ad/goBack). */}
        <FutureLetterModal
          visible={letterModalVisible}
          letter={currentLetter}
          onClose={() => {
            setLetterModalVisible(false);
            // Defer the rest of the post-lesson sequence until the
            // modal animation has dismissed, so the user sees a clean
            // hand-off rather than a paywall sliding in over the
            // letter as it fades.
            setTimeout(() => {
              runPostLetterFlow().catch(() => {});
            }, 220);
          }}
        />

        {showCelebration && (
          <View style={styles.celebration}>
            {/* Confetti burst overlays the entire celebration screen.
                Fires once per `showCelebration` true→false→true cycle
                (key = lessonId so chained lessons each get their own
                fresh burst, not a single shared instance). The 22
                particle pure-native animation is cheap even on older
                devices. Closes the audit's 'celebration moment is
                visually flat' finding. */}
            <ConfettiBurst trigger={lessonId} />

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
                  🔥
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
                {t('lesson.greatWork', 'Harika iş!')}
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

              {/* Momentum chain badge — fires when the just-completed
                  lesson was the 2nd, 3rd, 4th, or 5th+ in this session.
                  The bonus XP has already been added to totalXP by the
                  reducer; this surface is purely to make the user FEEL
                  the chain reward, which is what hooks them into the
                  next lesson too. Visible for ~5s then auto-cleared. */}
              {_momentumToast ? (
                <View style={styles.momentumBadge}>
                  <MaterialIcons name="bolt" size={16} color="#FDE047" />
                  <Text style={styles.momentumBadgeText}>
                    {t(
                      'lesson.momentumChain',
                      'MOMENTUM × {{count}} — +{{xp}} XP',
                      {
                        count: _momentumToast.chainCount,
                        xp: _momentumToast.bonusXp,
                      },
                    )}
                  </Text>
                </View>
              ) : null}

              {/* "Today you learned" takeaway card — surfaces the first
                  sentence of the teaching as a one-line summary. User
                  feedback: "they solve the quiz but the point is unclear."
                  This card directly answers "what did I just learn?"
                  Without it the celebration was all dopamine and no
                  cognition — feels like a game, not learning. */}
              {(() => {
                const teachingText = t(`${i18nBase}.teaching`, '');
                if (!teachingText) return null;
                const firstSentence = teachingText
                  .split(/[.!?](?=\s|$)/)
                  .map((s) => s.trim())
                  .filter((s) => s.length > 10)[0];
                if (!firstSentence) return null;
                return (
                  <View style={styles.takeawayCard}>
                    <Text style={styles.takeawayLabel}>
                      🎯 {t('lesson.takeawayLabel', 'BUGÜN ÖĞRENDİN')}
                    </Text>
                    <Text style={styles.takeawayBody}>{firstSentence}.</Text>
                  </View>
                );
              })()}

              {/* Reflection Mirror — surfaces a curated quote that
                  echoes the user's journal entry. The app shows it
                  "heard" them. Empathy hook; the strongest single
                  retention lever for any journaling app. */}
              {mirrorQuote ? (
                <View style={styles.mirrorCard}>
                  <Text style={styles.mirrorLabel}>
                    {t('lesson.mirrorLabel', 'A SAGE RESPONDS')}
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
                    {nextChainBonus > 0
                      ? t('lesson.nextLessonBonus', 'SIRADAKİNİ DE YAP · +{{xp}} XP', {
                          xp: nextChainBonus,
                        })
                      : t('lesson.nextLesson', 'Sonraki Dersi Başla')}
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
  // Multi-page teaching: header row with per-page label + counter.
  teachingPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  teachingPageCount: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onSurfaceVariant,
  },
  // Thin progress bar across the top of the card stack — keeps the
  // user oriented (they know how many pages remain).
  teachingProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: LT.surfaceContainer,
    overflow: 'hidden',
    marginBottom: 14,
  },
  teachingProgressFill: {
    height: '100%',
    backgroundColor: LT.primary,
  },
  // Back link to re-read a previous teaching page. Subtle —
  // the dominant flow is forward.
  teachingBackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  teachingBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
    textDecorationLine: 'underline',
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
  // "Today you learned" takeaway card on the celebration screen. Surfaces
  // the first sentence of the teaching so the user actually walks away
  // remembering WHAT they learned, not just that they tapped a button.
  takeawayCard: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(227, 18, 18, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: LT.primaryContainer,
    alignSelf: 'stretch',
    maxWidth: 380,
  },
  takeawayLabel: {
    color: LT.primaryContainer,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  takeawayBody: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
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
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 12, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: LT.outlineVariant,
    borderLeftWidth: 4,
  },
  explainBoxCorrect: {
    borderLeftColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  explainBoxLearn: {
    borderLeftColor: LT.primaryContainer,
    backgroundColor: 'rgba(227, 18, 18, 0.05)',
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  explainLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  explainLabelCorrect: { color: '#10B981' },
  explainLabelLearn: { color: LT.primaryContainer },
  explainText: {
    color: LT.onSurface,
    fontSize: 15, lineHeight: 22, fontWeight: '500',
  },
  // Depth sections appended below the short `explain` after a quiz
  // answer. The HEADER row is a small label ("KONUYA BAĞLAM" /
  // "NASIL UYGULA"); BODY is the content snippet. Visually muted so
  // the primary `explain` remains the headline, but available for
  // users who want to go deeper.
  quizDepthSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  quizDepthHeader: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.onSurfaceVariant,
    marginBottom: 6,
  },
  quizDepthBody: {
    fontSize: 13,
    color: LT.onSurface,
    lineHeight: 19,
    fontWeight: '500',
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
  // Momentum chain badge. Gold so it visually outranks the green quiz
  // pill — the chain is the BIG reward of stacking a multi-lesson
  // session, and we want the user's eye to land here.
  momentumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(253, 224, 71, 0.18)',
    borderColor: 'rgba(253, 224, 71, 0.55)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 10,
  },
  momentumBadgeText: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  celebrationStatText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
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
});
