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
import { showInterstitial, shouldShowAd, requestTrackingPermissionIfNeeded } from '../services/ads';
import MilestoneModal, { isMilestone } from '../components/MilestoneModal';
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
import { maybeTriggerPostLessonPaywall } from '../services/paywallTrigger';
import { LT, LT_RADIUS } from '../config/lightTheme';

const STEP = {
  TEACHING: 'teaching',
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
  } = useApp();

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
  const [outOfHeartsVisible, setOutOfHeartsVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
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

  // Track countdown for hearts refill
  useEffect(() => {
    if (!heartsRefillAt || hearts >= 5 || isPremium) return;
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, [heartsRefillAt, hearts, isPremium]);

  const refillMins = (() => {
    if (isPremium || hearts >= 5 || !heartsRefillAt) return null;
    const ms = new Date(heartsRefillAt).getTime() - now;
    if (ms <= 0) return 0;
    return Math.ceil(ms / 60000);
  })();

  const celebrationScale = useRef(new Animated.Value(0)).current;
  const xpY = useRef(new Animated.Value(0)).current;
  const stepProgress = useRef(new Animated.Value(0.33)).current;

  const alreadyCompleted = pathProgress?.[pathId]?.completed?.includes(lessonId);

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
  const teaching = t(`${i18nBase}.teaching`, '');
  const action = t(`${i18nBase}.action`, '');
  const reflectionPrompt = t(`${i18nBase}.reflectionPrompt`, '');
  const proTipKey = `${i18nBase}.proTip`;
  const proTipRaw = t(proTipKey, '');
  const proTip = proTipRaw && proTipRaw !== proTipKey ? proTipRaw : '';
  const hasQuiz = quiz.length > 0;
  const currentQuestion = hasQuiz ? quiz[quizIndex] : null;

  const handleTeachingNext = () => {
    playSound('tap').catch(() => {});
    if (hasQuiz) setStep(STEP.QUIZ);
    else setStep(STEP.COMMIT);
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
    } else {
      playSound('wrong').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (!isPremium && hearts > 0) {
        loseHeart();
        // If this was the last heart, show modal after a brief moment
        if (hearts === 1) {
          setTimeout(() => setOutOfHeartsVisible(true), 800);
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
    if (completing || alreadyCompleted) return;
    setCompleting(true);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      playSound('complete').catch(() => {});
    } catch {}

    completePathLesson({
      pathId,
      lessonId,
      reflection: reflection.trim(),
      reflectionAudioUri: recordingUri || null,
      quizCorrect: correctCount,
      xp: 15 + correctCount * 5,
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
    }, 1800);
    // No auto-dismiss — user picks "Yola Dön" or "Sonraki Ders" from celebration
  };

  const handleCelebrationContinue = async () => {
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

  const renderTeaching = () => (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepLabel}>📖 {t('lesson.teaching', 'ÖĞRETİM')}</Text>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.heroBox}>
        <LinearGradient
          colors={[LT.surfaceContainerLowest, LT.surfaceContainerLowest]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroMascot}>
          <MaterialIcons name="self-improvement" size={68} color={LT.primaryContainer} />
        </View>
      </View>

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

        <OutOfHeartsModal
          visible={outOfHeartsVisible}
          refillMins={refillMins}
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
            </View>

            {/* CTA buttons */}
            <View style={styles.celebrationCTAs}>
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
