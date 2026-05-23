import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Easing,
  Image,
  StatusBar,
} from 'react-native';
import Animated2, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { COLORS } from '../config/constants';
import { LT, LT_RADIUS } from '../config/lightTheme';
import { PATHS } from '../data/paths';
import { ARCHETYPES, DEFAULT_ARCHETYPE_ID, getArchetypeById } from '../data/archetypes';
import {
  ASSESSMENT_DIMENSIONS,
  ASSESSMENT_MAX_PER_DIM,
  defaultScores,
} from '../data/assessment';
import { setLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES } from '../i18n';
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

// Onboarding flow. UX audit findings (May 2026):
//   - The original 'welcome' step was a static splash card that
//     added one extra tap to time-to-first-lesson without surfacing
//     any new information. Removed.
//   - The new 'archetype' step asks "who are you becoming?" — the
//     single strongest retention lever in identity-based habit
//     design (Clear, Atomic Habits ch.2). Choice is echoed back on
//     Home + notifications.
//   - Total taps to land in lesson #1: 3 (personalize → pickPath →
//     archetype) + optional upsell. Was: 4 mandatory + upsell.
// Adding the 'assessment' step at the end (just before upsell) means
// we get the user's baseline numbers AT the moment they're most
// engaged — they've just committed to a path + archetype. The
// upsell still fires after; assessment is non-blocking (skippable
// via the AssessmentScreen) so it doesn't add a hard gate.
const STEPS = ['personalize', 'pickPath', 'archetype', 'assessment', 'upsell'];

// Map a chosen goal to the path that best fits it. Used to pre-select on the
// next step so the personalization actually affects what the user sees first.
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
    setBaselineAssessment,
    isPremium,
  } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState('personalize');
  const [selectedPath, setSelectedPath] = useState('dopamine-detox');
  const [selectedArchetype, setSelectedArchetype] = useState(
    DEFAULT_ARCHETYPE_ID,
  );
  // `name` lives inside answers so it stays in userProfile.answers and
  // syncs to the cloud alongside goal/time/mood. Empty string by default
  // (skippable) — the app falls back to "Sen" wherever name is null/empty.
  const [answers, setAnswers] = useState({
    name: '',
    goal: null,
    time: null,
    mood: null,
  });

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const finishOnboarding = () => {
    setUserProfile({
      // Hoist name to the top level so HomeScreen/notifications can read
      // userProfile.name without spelunking into answers. answers still
      // keeps it for cloudSync compatibility.
      name: (answers.name || '').trim() || null,
      goals: answers.goal ? [answers.goal] : ['discipline'],
      archetype: selectedArchetype, // identity-based framing surface
      answers,
    });
    setActivePath(selectedPath);
    completeOnboarding();

    // Funnel event — top of the activation funnel. Props capture the
    // personalization signal so we can later see e.g. "is the focus goal
    // group converting better than discipline?".
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

    // Land DIRECTLY in lesson #1 instead of dumping the user onto
    // HomeScreen's 14-card scroll. Audit finding: new users on Home
    // bounced before tapping the CTA — TTV (time-to-first-value) was
    // measured at ~90s instead of the target ~15s. Replacing the
    // navigation stack with the lesson route means back-button from
    // the lesson goes to Home, not back into onboarding.
    const firstLesson = `${selectedPath}-1`;
    setTimeout(() => {
      try {
        navigation?.replace?.('Lesson', {
          pathId: selectedPath,
          lessonId: firstLesson,
        });
      } catch {
        // If navigation isn't available for any reason, the existing
        // root navigator will land them on Home — same as before.
      }
    }, 250);

    // Sequenced post-onboarding flow (Apple-compliant ordering):
    //   1. Notification permission (5.1.1 — ask at meaningful moment)
    //   2. ATT prompt (App Tracking Transparency)
    //   3. AdMob SDK init (AFTER ATT — never before)
    //
    // Apple Review submission 52b37ca1 rejected v1.0.10 b52 because
    // they couldn't surface the ATT prompt during their iPad review.
    // The prompt was previously gated to first-lesson-completion; a
    // reviewer browsing in guest mode never tapped a lesson. Now the
    // prompt fires within ~30s of fresh install. Equally important:
    // the ad SDK does NOT initialize until ATT has resolved, so no
    // third-party tracking can possibly happen before consent.
    (async () => {
      try {
        const granted = await requestNotificationPermissions();
        if (granted) {
          // New user → currentStreak is 0, so scheduleDailyReminder
          // will pick the "begin monk mode" variant (not the streak-
          // formatted one). Pass explicitly to keep the API contract
          // clean and obvious.
          // Pass archetype name so the push title rotation can
          // surface "Sessiz Savaşçı, bugün başla" — turning the
          // onboarding archetype choice into a daily echo.
          scheduleDailyReminder({
            currentStreak: 0,
            userName: answers.name || '',
            archetypeName: t(
              getArchetypeById(selectedArchetype).nameKey,
              getArchetypeById(selectedArchetype).nameFallback,
            ),
            // Path-optimal hour — silent-morning users get 7 AM,
            // dopamine-detox users get 8 PM, etc.
            activePathId: selectedPath,
          }).catch(() => {});
          scheduleWeeklyRecap().catch(() => {});
          // D1 + D3 first-week hooks — these are the only outside-app
          // touchpoint for a brand-new user before they build a streak,
          // and they're the highest-leverage retention push slots we have.
          // Cancelled automatically by LessonScreen once the user finishes
          // their first lesson (no nagging the already-activated).
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
    // When user picks a goal, pre-select the matching path so pickPath opens
    // already focused on the right one — small thing, big "this app gets me"
    // effect.
    if (key === 'goal' && GOAL_TO_PATH[value]) {
      setSelectedPath(GOAL_TO_PATH[value]);
    }
  };

  const handleNext = () => {
    buttonScale.value = withSpring(0.95, {}, () => {
      buttonScale.value = withSpring(1);
    });

    if (step === 'personalize') {
      setStep('pickPath');
    } else if (step === 'pickPath') {
      setStep('archetype');
    } else if (step === 'archetype') {
      setStep('assessment');
    } else if (step === 'assessment') {
      // Skip upsell for premium users — they've already converted.
      if (isPremium) {
        finishOnboarding();
      } else {
        setStep('upsell');
      }
    } else {
      // upsell step — Skip without buying
      finishOnboarding();
    }
  };

  const handleUpsellSubscribe = () => {
    // Save profile + activate path BEFORE going to paywall, so even if user
    // backs out we don't lose onboarding state
    setUserProfile({
      // Hoist name to the top level so HomeScreen/notifications can read
      // userProfile.name without spelunking into answers. answers still
      // keeps it for cloudSync compatibility.
      name: (answers.name || '').trim() || null,
      goals: answers.goal ? [answers.goal] : ['discipline'],
      archetype: selectedArchetype,
      answers,
    });
    setActivePath(selectedPath);
    completeOnboarding();
    // Same sequenced ATT-then-ads flow as finishOnboarding. Even premium
    // users go through ATT — they may downgrade later and need consent
    // already on file.
    (async () => {
      try { await requestTrackingPermissionIfNeeded(); } catch {}
      try {
        await initAds();
        loadInterstitial().catch(() => {});
        loadRewarded().catch(() => {});
      } catch {}
    })();
    // Navigate to paywall after onboarding completes
    setTimeout(() => navigation?.navigate?.('Paywall'), 300);
  };

  // Personalize step USED to require a goal pick (canAdvance = goal != null).
  // That was killing D1: users hit a mandatory form before seeing the app
  // and bailed. Goal pre-selects the path nicely when chosen, but it's
  // strictly optional now — empty goal falls back to the default path.
  const canAdvance = true;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />
      <View style={styles.container}>
        {/* Hero ambient glow */}
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
        ) : step === 'assessment' ? (
          <BaselineAssessmentStep
            t={t}
            onSave={(scores) => setBaselineAssessment(scores)}
          />
        ) : (
          <UpsellStep t={t} onSubscribe={handleUpsellSubscribe} />
        )}

        <Animated2.View style={[styles.bottomArea, animatedButtonStyle]}>
          {/* Step dots */}
          <View style={styles.dots}>
            {STEPS.map((s, i) => {
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

          {/* Primary CTA — solid red */}
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
                      : step === 'assessment'
                        ? t('onboarding.continueAssessment', 'Başlangıcı kaydet')
                        : t('onboarding.skipUpsell', 'Şimdilik Atla')}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Caption */}
          <Text style={styles.caption}>
            {step === 'personalize'
              ? t('onboarding.captionPersonalize', 'KİŞİSEL PLAN OLUŞTURULUYOR')
              : step === 'pickPath'
                ? t('onboarding.captionPickPath', 'YOLUNU SEÇ')
                : step === 'archetype'
                  ? t('onboarding.captionArchetype', '30 GÜN SONRA NE OLACAKSIN')
                  : step === 'assessment'
                    ? t('onboarding.captionAssessment', 'BAŞLANGIÇ NOKTAN ÖLÇÜLÜYOR')
                    : t('onboarding.captionUpsell', 'PREMIUM İLE TAMAM')}
          </Text>
        </Animated2.View>
      </View>
    </SafeAreaView>
  );
}

function WelcomeStep({ t }) {
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const handleChangeLang = async (code) => {
    await setLanguage(code);
    setCurrentLang(code);
  };

  // Subtle pulse on hero
  const ringSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 60000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [ringSpin]);
  const spin = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <ScrollView
      contentContainerStyle={styles.welcomeContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero with progress ring decoration */}
      <View style={styles.heroWrap}>
        <Animated.View style={[styles.ringDecor, { transform: [{ rotate: spin }] }]} />
        <View style={styles.heroCircle}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Title block */}
      <Text style={styles.title}>{t('onboarding.title', 'MONK MODE').toUpperCase()}</Text>
      <Text style={styles.subtitle}>{t('onboarding.subtitle', 'Disiplini seç. Yolu yürü. Kendini dönüştür.')}</Text>

      {/* Card features */}
      <View style={styles.featuresContainer}>
        <FeatureCard
          icon="menu-book"
          iconColor={LT.primary}
          tint={LT.surfaceContainerLow}
          border={LT.outlineVariant}
          title={t('onboarding.bullet1', 'Her gün tek ders')}
          subtitle={t('onboarding.bullet1Sub', 'Odaklanmış gelişim için mikro öğrenme.')}
        />
        <FeatureCard
          icon="psychology"
          iconColor={LT.primaryContainer}
          tint={LT.surfaceContainerLow}
          border={LT.outlineVariant}
          title={t('onboarding.bullet2', 'Quiz ile pekiştir')}
          subtitle={t('onboarding.bullet2Sub', 'Bilgini anında test et ve kalıcı kıl.')}
        />
        <FeatureCard
          icon="favorite"
          iconColor={LT.primary}
          tint={LT.surfaceContainerLow}
          border={LT.outlineVariant}
          title={t('onboarding.bullet3', 'Kalpleri kaybetme')}
          subtitle={t('onboarding.bullet3Sub', 'Serini koru ve ustalık seviyeni yükselt.')}
        />
      </View>

      {/* Language picker — minimal */}
      <View style={styles.langRow}>
        {SUPPORTED_LANGUAGES.map((l) => {
          const active = currentLang === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              onPress={() => handleChangeLang(l.code)}
              activeOpacity={0.7}
              style={[styles.langBtn, active && styles.langBtnActive]}
            >
              <Text style={styles.langFlag}>{l.flag}</Text>
              <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function PersonalizeStep({ t, answers, onAnswer }) {
  const goalOptions = [
    { id: 'focus', icon: 'center-focus-strong', labelKey: 'onboarding.goalFocus', fallback: 'Daha çok odaklan' },
    { id: 'morning', icon: 'wb-twilight', labelKey: 'onboarding.goalMorning', fallback: 'Sabah rutinim' },
    { id: 'fitness', icon: 'fitness-center', labelKey: 'onboarding.goalFitness', fallback: 'Vücut disiplini' },
    { id: 'money', icon: 'account-balance-wallet', labelKey: 'onboarding.goalMoney', fallback: 'Para disiplini' },
    { id: 'discipline', icon: 'whatshot', labelKey: 'onboarding.goalGeneral', fallback: 'Genel disiplin' },
  ];
  const timeOptions = [
    { id: '5', labelKey: 'onboarding.time5', fallback: '5 dk' },
    { id: '15', labelKey: 'onboarding.time15', fallback: '15 dk' },
    { id: '30', labelKey: 'onboarding.time30', fallback: '30+ dk' },
  ];
  const moodOptions = [
    { id: 'motivated', icon: 'whatshot', labelKey: 'onboarding.moodMotivated', fallback: 'Yüksek motivasyon' },
    { id: 'lost', icon: 'help-outline', labelKey: 'onboarding.moodLost', fallback: 'Karışık hissediyorum' },
    { id: 'fresh', icon: 'auto-awesome', labelKey: 'onboarding.moodFresh', fallback: 'Yeni başlangıç' },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.personalizeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.personalizeIntro}>
        {t('onboarding.personalizeIntro', 'Sana özel plan için 3 hızlı soru')}
      </Text>

      {/* Name — optional. Drives personalised push titles + Home greeting.
          Opt-out friendly (placeholder hints that it's skippable). */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qName', 'Sana nasıl seslenelim?')}
      </Text>
      <TextInput
        value={answers.name || ''}
        onChangeText={(txt) => onAnswer('name', txt.slice(0, 24))}
        placeholder={t('onboarding.namePlaceholder', 'Adın (opsiyonel)')}
        placeholderTextColor={LT.outline}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={24}
        returnKeyType="done"
        style={styles.nameInput}
      />

      {/* Goal */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qGoal', 'Ne için buradasın?')}
      </Text>
      <View style={styles.optionList}>
        {goalOptions.map((opt) => {
          const active = answers.goal === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onAnswer('goal', opt.id)}
              activeOpacity={0.85}
              style={[styles.optionCard, active && styles.optionCardActive]}
            >
              <View style={[styles.optionIconBox, active && styles.optionIconBoxActive]}>
                <MaterialIcons
                  name={opt.icon}
                  size={20}
                  color={active ? LT.onPrimary : LT.onSurfaceVariant}
                />
              </View>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
              {active ? (
                <MaterialIcons name="check-circle" size={18} color={LT.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Time */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qTime', 'Günde ne kadar zaman ayırabilirsin?')}
      </Text>
      <View style={styles.optionRow}>
        {timeOptions.map((opt) => {
          const active = answers.time === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onAnswer('time', opt.id)}
              activeOpacity={0.85}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mood */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qMood', 'Şu an nasıl hissediyorsun?')}
      </Text>
      <View style={styles.optionList}>
        {moodOptions.map((opt) => {
          const active = answers.mood === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onAnswer('mood', opt.id)}
              activeOpacity={0.85}
              style={[styles.optionCard, active && styles.optionCardActive]}
            >
              <View style={[styles.optionIconBox, active && styles.optionIconBoxActive]}>
                <MaterialIcons
                  name={opt.icon}
                  size={20}
                  color={active ? LT.onPrimary : LT.onSurfaceVariant}
                />
              </View>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
              {active ? (
                <MaterialIcons name="check-circle" size={18} color={LT.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function FeatureCard({ icon, iconColor, tint, border, title, subtitle }) {
  return (
    <View style={styles.featureCard}>
      <View style={[styles.featureIconBox, { backgroundColor: tint, borderColor: border }]}>
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function UpsellStep({ t, onSubscribe }) {
  return (
    <ScrollView
      contentContainerStyle={styles.upsellContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.upsellEmoji}>🔥</Text>
      <Text style={styles.upsellTitle}>
        {t('onboarding.upsellTitle', 'Disiplini hızlandır')}
      </Text>

      {/* Apple HIG 3.1.2(c): the billed amount must be the most clear and
          conspicuous pricing element. Free trial info is subordinate. */}
      <View style={styles.priceBlock}>
        <Text style={styles.priceAmount}>
          {t('onboarding.priceMonthly', '₺149,99 / ay')}
        </Text>
        <Text style={styles.priceTrial}>
          {t(
            'onboarding.priceTrial',
            'İlk 7 gün ücretsiz, sonra otomatik yenilenir. İstediğin an iptal et.',
          )}
        </Text>
      </View>

      <View style={styles.upsellFeatures}>
        <UpsellFeature
          icon="favorite"
          color={LT.primary}
          title={t('onboarding.upsellF1', 'Sınırsız kalpler')}
        />
        <UpsellFeature
          icon="workspace-premium"
          color={LT.primaryContainer}
          title={t('onboarding.upsellF2', 'Tüm 5 yolun kilidi açık')}
        />
        <UpsellFeature
          icon="block"
          color={LT.tertiary}
          title={t('onboarding.upsellF3', 'Reklamsız deneyim')}
        />
        <UpsellFeature
          icon="auto-awesome"
          color={LT.primary}
          title={t('onboarding.upsellF4', 'Premium başarılar')}
        />
      </View>

      <TouchableOpacity
        onPress={onSubscribe}
        activeOpacity={0.9}
        style={styles.upsellCtaWrap}
      >
        <View style={styles.upsellCta}>
          <MaterialIcons name="auto-awesome" size={18} color={LT.onPrimary} />
          <Text style={styles.upsellCtaText}>
            {t('onboarding.upsellCta', 'Aboneliği başlat')}
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.upsellDisclaimer}>
        {t(
          'onboarding.upsellDisclaimer',
          '₺149,99/ay — abonelik otomatik yenilenir. App Store\'dan dilediğin an iptal edebilirsin.',
        )}
      </Text>
    </ScrollView>
  );
}

function UpsellFeature({ icon, color, title }) {
  return (
    <View style={styles.upsellFeature}>
      <View style={[styles.upsellFeatureIcon, { backgroundColor: LT.surfaceContainerLow, borderColor: LT.outlineVariant }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.upsellFeatureText}>{title}</Text>
    </View>
  );
}

// Identity Archetype picker. Shown after the user picks a path. Three
// vertical cards because we want each option to feel substantial enough
// to be a real identity claim, not a quiz answer. The chosen archetype
// is surfaced back on HomeScreen and in re-engagement notifications,
// making the onboarding choice consequential (not theatre).
function ArchetypeStep({ t, selectedArchetype, onSelect }) {
  return (
    <View style={styles.archetypeContent}>
      <Text style={styles.pickTitle}>
        {t(
          'onboarding.archetypeTitle',
          '30 gün sonra hangisi olacaksın?',
        )}
      </Text>
      <Text style={styles.pickSubtitle}>
        {t(
          'onboarding.archetypeSubtitle',
          'Bir tane seç. Sonraki 30 gün boyunca bu kişi olarak hareket edeceksin.',
        )}
      </Text>
      <ScrollView
        contentContainerStyle={styles.archetypeList}
        showsVerticalScrollIndicator={false}
      >
        {ARCHETYPES.map((a) => {
          const isSelected = selectedArchetype === a.id;
          return (
            <TouchableOpacity
              key={a.id}
              onPress={() => onSelect(a.id)}
              activeOpacity={0.85}
              style={[
                styles.archetypeCard,
                {
                  borderColor: isSelected ? a.accent : LT.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                  shadowOpacity: isSelected ? 0.15 : 0.04,
                },
              ]}
            >
              <View
                style={[
                  styles.archetypeIconBox,
                  { backgroundColor: isSelected ? a.accent : LT.surfaceContainer },
                ]}
              >
                <MaterialIcons
                  name={a.icon}
                  size={28}
                  color={isSelected ? '#fff' : LT.onSurfaceVariant}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.archetypeName}>
                  {t(a.nameKey, a.nameFallback)}
                </Text>
                <Text style={styles.archetypeTag}>
                  {t(a.tagKey, a.tagFallback)}
                </Text>
                <Text style={styles.archetypeDesc}>
                  {t(a.descKey, a.descFallback)}
                </Text>
              </View>
              {isSelected ? (
                <MaterialIcons
                  name="check-circle"
                  size={22}
                  color={a.accent}
                  style={styles.archetypeCheck}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Baseline Assessment step — collects the 5-dimension self-rating
// that future ProgressReportScreen will compare against. We use an
// internal local state so the user can adjust before hitting the
// onboarding primary CTA; on every change we sync upstream via
// onSave so leaving mid-step still persists what they chose.
function BaselineAssessmentStep({ t, onSave }) {
  const [scores, setScoresLocal] = useState(defaultScores());
  const setScore = (id, v) => {
    setScoresLocal((prev) => {
      const next = { ...prev, [id]: v };
      onSave(next); // persist on every slider tap; cheap
      return next;
    });
  };
  // Persist defaults the first render too, so a user who blasts
  // through with "Devam et" still has a baseline of 5/10 across
  // the board (not nothing — nothing breaks the delta system).
  useEffect(() => {
    onSave(defaultScores());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.assessmentStepContent}>
      <Text style={styles.pickTitle}>
        {t(
          'onboarding.assessmentTitle',
          'Bugünün senini ölç. 30 gün sonra geri bakacağız.',
        )}
      </Text>
      <Text style={styles.pickSubtitle}>
        {t(
          'onboarding.assessmentSubtitle',
          '5 alanı 1-10 arası işaretle. Mükemmel cevap yok — dürüst cevap var.',
        )}
      </Text>
      <ScrollView
        contentContainerStyle={styles.assessmentList}
        showsVerticalScrollIndicator={false}
      >
        {ASSESSMENT_DIMENSIONS.map((dim) => (
          <View key={dim.id} style={styles.assessmentRow}>
            <View style={styles.assessmentRowHeader}>
              <View
                style={[
                  styles.assessmentIconBox,
                  { backgroundColor: `${dim.color}22`, borderColor: `${dim.color}55` },
                ]}
              >
                <MaterialIcons name={dim.icon} size={16} color={dim.color} />
              </View>
              <Text style={styles.assessmentLabel}>
                {t(dim.labelKey, dim.labelFallback)}
              </Text>
              <Text style={[styles.assessmentValue, { color: dim.color }]}>
                {scores[dim.id]}
              </Text>
            </View>
            <Text style={styles.assessmentQ}>
              {t(dim.questionKey, dim.questionFallback)}
            </Text>
            <View style={styles.scaleRowOb}>
              {Array.from({ length: ASSESSMENT_MAX_PER_DIM }, (_, i) => i + 1).map((v) => {
                const isUnder = scores[dim.id] >= v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setScore(dim.id, v)}
                    style={[
                      styles.scaleDotOb,
                      isUnder && { backgroundColor: dim.color },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function PickPathStep({ t, selectedPath, onSelect }) {
  return (
    <View style={styles.pickPathContent}>
      <Text style={styles.pickTitle}>
        {t('onboarding.pickPathTitle', 'Hangi disipline odaklanacaksın?')}
      </Text>
      <Text style={styles.pickSubtitle}>
        {t('onboarding.pickPathSubtitle', 'Gelişim yolculuğuna başlamak için temel bir yol seç.')}
      </Text>
      <ScrollView
        contentContainerStyle={styles.pathGrid}
        showsVerticalScrollIndicator={false}
      >
        {PATHS.map((p) => {
          const isSelected = selectedPath === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => onSelect(p.id)}
              activeOpacity={0.85}
              style={[
                styles.pathGridCard,
                {
                  borderColor: isSelected ? LT.primary : LT.outlineVariant,
                  borderWidth: isSelected ? 2 : 1,
                  backgroundColor: LT.surfaceContainerLowest,
                  shadowColor: isSelected ? LT.primary : '#000',
                  shadowOpacity: isSelected ? 0.18 : 0.05,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: isSelected ? 6 : 2,
                },
              ]}
            >
              {isSelected && (
                <View style={styles.pathCheckBadge}>
                  <MaterialIcons name="check-circle" size={20} color={LT.primary} />
                </View>
              )}
              <View style={styles.pathGridIconBox}>
                <MaterialIcons name={p.materialIcon} size={32} color={isSelected ? LT.primary : LT.onSurfaceVariant} />
              </View>
              <Text style={styles.pathGridName}>
                {t(`paths.${p.id}.title`, p.id)}
              </Text>
              <Text style={styles.pathGridDuration}>
                {t('path.lessonsCount', '{{count}} ders', { count: p.duration })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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

  // Welcome
  welcomeContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    flexGrow: 1,
  },
  heroWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ringDecor: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  heroCircle: {
    width: 184,
    height: 184,
    borderRadius: 92,
    overflow: 'hidden',
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: { width: '100%', height: '100%' },

  title: {
    fontSize: 32,
    fontWeight: '900',
    color: LT.onSurface,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
    fontWeight: '500',
  },

  // Cards
  featuresContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureText: { flex: 1 },
  featureTitle: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureSubtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },

  // Language picker
  langRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  langBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLowest,
  },
  langBtnActive: {
    borderColor: LT.primary,
    backgroundColor: LT.surfaceContainerLow,
  },
  langFlag: { fontSize: 18, marginBottom: 2 },
  langLabel: { fontSize: 11, color: LT.onSurfaceVariant, fontWeight: '600' },
  langLabelActive: { color: LT.primary, fontWeight: '700' },

  // Pick path step
  pickPathContent: { flex: 1, paddingTop: 40 },

  // Baseline assessment — quick inline 5-question form
  assessmentStepContent: { flex: 1, paddingTop: 40 },
  assessmentList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  assessmentRow: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  assessmentRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  assessmentIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  assessmentLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: LT.onSurface,
  },
  assessmentValue: {
    fontSize: 18,
    fontWeight: '900',
    minWidth: 24,
    textAlign: 'right',
  },
  assessmentQ: {
    fontSize: 12,
    color: LT.onSurfaceVariant,
    lineHeight: 16,
    marginBottom: 10,
  },
  scaleRowOb: {
    flexDirection: 'row',
    gap: 3,
  },
  scaleDotOb: {
    flex: 1,
    height: 18,
    borderRadius: 4,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },

  // Archetype step — identity-based framing
  archetypeContent: { flex: 1, paddingTop: 40 },
  archetypeList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  archetypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  archetypeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archetypeName: {
    fontSize: 16,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 2,
  },
  archetypeTag: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.primary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  archetypeDesc: {
    fontSize: 12,
    color: LT.onSurfaceVariant,
    lineHeight: 16,
  },
  archetypeCheck: {
    marginLeft: 4,
  },

  // Upsell step
  upsellContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  upsellEmoji: {
    fontSize: 56,
    marginBottom: 12,
    textShadowColor: 'rgba(183, 0, 6, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  upsellTitle: {
    color: LT.primary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 14,
  },
  // Apple HIG 3.1.2(c): billed amount must be the most prominent pricing element.
  priceBlock: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  priceAmount: {
    color: LT.onSurface,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  priceTrial: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
  },
  upsellSubtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  upsellFeatures: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  upsellFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.surfaceContainerLowest,
    borderColor: LT.outlineVariant,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  upsellFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  upsellFeatureText: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  upsellCtaWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
    backgroundColor: LT.primary,
  },
  upsellCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: LT.primary,
  },
  upsellCtaText: {
    color: LT.onPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  upsellDisclaimer: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  pickTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: LT.onSurface,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pickSubtitle: {
    fontSize: 13,
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
    fontWeight: '500',
  },
  pathGrid: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  pathGridCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    position: 'relative',
  },
  pathCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
  pathGridIconBox: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pathGridName: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  pathGridDuration: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Bottom area
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
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

  // Personalize step
  personalizeContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  personalizeIntro: {
    fontSize: 14,
    color: LT.onSurfaceVariant,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  personalizeQ: {
    fontSize: 16,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 10,
    marginTop: 14,
    letterSpacing: -0.2,
  },
  nameInput: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: LT.onSurface,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionCardActive: {
    borderColor: LT.primary,
    borderWidth: 2,
    backgroundColor: LT.surfaceContainerLow,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  optionIconBoxActive: {
    backgroundColor: LT.primary,
    borderColor: LT.primary,
  },
  optionLabel: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: LT.primary,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLowest,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: LT.primary,
    borderWidth: 2,
    backgroundColor: LT.surfaceContainerLow,
  },
  chipLabel: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
  },
  chipLabelActive: {
    color: LT.primary,
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
