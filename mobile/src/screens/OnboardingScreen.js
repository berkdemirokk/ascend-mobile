import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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

const STEPS = ['welcome', 'personalize', 'pickPath', 'upsell'];

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
  const { completeOnboarding, setUserProfile, setActivePath, isPremium } = useApp();
  const [step, setStep] = useState('welcome');
  const [selectedPath, setSelectedPath] = useState('dopamine-detox');
  const [answers, setAnswers] = useState({ goal: null, time: null, mood: null });

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const finishOnboarding = () => {
    setUserProfile({
      goals: answers.goal ? [answers.goal] : ['discipline'],
      answers,
    });
    setActivePath(selectedPath);
    completeOnboarding();

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
          scheduleDailyReminder({ currentStreak: 0 }).catch(() => {});
          scheduleWeeklyRecap().catch(() => {});
          // D1 + D3 first-week hooks — these are the only outside-app
          // touchpoint for a brand-new user before they build a streak,
          // and they're the highest-leverage retention push slots we have.
          // Cancelled automatically by LessonScreen once the user finishes
          // their first lesson (no nagging the already-activated).
          scheduleFirstWeekHooks().catch(() => {});
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

    if (step === 'welcome') {
      setStep('personalize');
    } else if (step === 'personalize') {
      setStep('pickPath');
    } else if (step === 'pickPath') {
      // Skip upsell for premium users
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
      goals: answers.goal ? [answers.goal] : ['discipline'],
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

        {step === 'welcome' ? (
          <WelcomeStep t={t} />
        ) : step === 'personalize' ? (
          <PersonalizeStep t={t} answers={answers} onAnswer={handleAnswer} />
        ) : step === 'pickPath' ? (
          <PickPathStep
            t={t}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
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
                {step === 'welcome'
                  ? t('onboarding.cta', 'Başla')
                  : step === 'personalize'
                    ? t('onboarding.continuePersonalize', 'Devam et')
                    : step === 'pickPath'
                      ? t('onboarding.startPath', 'Bu yolu başlat')
                      : t('onboarding.skipUpsell', 'Şimdilik Atla')}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          {/* Caption */}
          <Text style={styles.caption}>
            {step === 'welcome'
              ? t('onboarding.captionWelcome', 'STRATEJİK ODAKLANMA BAŞLATILIYOR')
              : step === 'personalize'
                ? t('onboarding.captionPersonalize', 'KİŞİSEL PLAN OLUŞTURULUYOR')
                : step === 'pickPath'
                  ? t('onboarding.captionPickPath', 'YOLUNU SEÇ')
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
    >
      <Text style={styles.personalizeIntro}>
        {t('onboarding.personalizeIntro', 'Sana özel plan için 3 hızlı soru')}
      </Text>

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
