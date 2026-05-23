// HomeScreen — dashboard tab in the redesigned 4-tab nav.
// Shows: streak hero, today's CTA (jump to current lesson), premium upsell (if free),
// quick stats, recent activity. Vivid Impact light theme.

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import {
  PATHS,
  getPathById,
  getPathLessons,
  getCurrentLesson,
} from '../data/paths';
import LightTopAppBar from '../components/LightTopAppBar';
import StreakInfoModal from '../components/StreakInfoModal';
import BannerAdBox from '../components/BannerAdBox';
import LessonQueueCard from '../components/LessonQueueCard';
// DailyMysteryBox + DailyMoodCheckIn removed in the Home agresif
// sadeleştirme pass. Daily Deck now covers the variable-reward slot
// (and is content-rich, not just an XP roll), and the mood signal
// was only ever feeding DailyPlanCard (also removed) — dead loop.
import StreakRiskBanner from '../components/StreakRiskBanner';
import StreakLostBanner from '../components/StreakLostBanner';
import PledgeModal from '../components/PledgeModal';
import Skeleton from '../components/Skeleton';
import { getArchetypeById } from '../data/archetypes';
import { POST_ASSESSMENT_INTERVAL_DAYS } from '../data/assessment';
// WeekendBoostBanner + DailyPlanCard removed in the same Home pass.
// WeekendBoost duplicated the Weekend Offer below it (two cards
// fighting for the same Sat/Sun premium pitch); DailyPlanCard's
// "smart picks" never paid for the visual real estate it took —
// LessonQueueCard above it already shows the next lesson chain.
import OutOfHeartsModal from '../components/OutOfHeartsModal';
// generateDailyPlan import removed alongside DailyPlanCard. The
// generator file still exists for now but has no consumers; safe to
// delete in a follow-up cleanup pass.
import {
  requestTrackingPermissionIfNeeded,
  initAds,
  loadInterstitial,
  loadRewarded,
  showRewarded,
  isAdsReady,
} from '../services/ads';
import {
  getDailyChallenge,
  DAILY_CHALLENGE_BONUS_XP,
} from '../config/dailyChallenges';
import {
  analyzeReflections,
  dominantReflectionCategory,
  collectReflectionTexts,
} from '../services/reflectionSignals';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  // Hydration gate — see comment near the skeleton render below.
  const {
    _loaded,
    pathProgress,
    activePathId,
    isPremium,
    currentStreak,
    longestStreak,
    totalXP,
    level,
    userProfile,
    todayCompleted,
    lessonHistory,
    _streakFreezeToast,
    _streakLostInfo,
    streakFreezes,
    clearStreakFreezeToast,
    clearStreakLostInfo,
    restoreStreakFromRepair,
    pathPledges,
    setPathPledge,
    todaySessionLessons,
    lastLessonAtMs,
    baselineAssessment,
    latestAssessment,
    lastDailyDeckCompletedDate,
    dailyChallengeCompletedAt,
    completeDailyChallenge,
    // dailyMysteryBox* / dailyMoodCheckIn* / openMysteryBox / setDailyMood
    // pulled out alongside the cards. State still lives in AppContext
    // (so existing users' last-opened-date isn't broken on upgrade)
    // but Home no longer consumes any of it.
    vacationUntil,
    hearts,
    heartsRefillAt,
    refillHearts,
  } = useApp();

  // Day-bucket booleans for the per-day cards. Stable across re-renders
  // within the same day.
  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // mysteryBoxOpenedToday / moodPickedToday derived state removed.

  // OutOfHearts gating — Home has three entry points into a lesson
  // (today CTA button, lesson queue card, 3+ streak auto-route). Without
  // the gate, a free user with 0 hearts could blast through lessons
  // with zero consequence. We intercept the tap, show the OutOfHearts
  // modal, and only navigate after the user either watches an ad,
  // upgrades, or hearts auto-refill.
  const [outOfHeartsVisible, setOutOfHeartsVisible] = useState(false);

  /**
   * Centralised navigate-to-lesson handler used by every Home entry
   * point. Returns true if navigation actually fired, false if we
   * blocked it (showed the OutOfHearts modal instead).
   */
  const attemptStartLesson = (pathId, lessonId) => {
    if (!isPremium && (hearts || 0) <= 0) {
      setOutOfHeartsVisible(true);
      return false;
    }
    navigation.navigate('Lesson', { pathId, lessonId });
    return true;
  };

  // Today's pseudo-random challenge — same for everyone on the same date.
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  // Reflection-based "what does the user actually care about" signal.
  // Looks across all their lesson reflections, counts keyword hits per
  // category (detox/body/mind/money/social), and returns the dominant
  // one. Null until they've written enough to be confident (>=3 hits).
  // Used to override the onboarding "goal" answer when the user's
  // actual writings tell a different story.
  const reflectionDominant = useMemo(() => {
    const texts = collectReflectionTexts(pathProgress);
    if (!texts.length) return null;
    const weights = analyzeReflections(texts);
    return dominantReflectionCategory(weights);
  }, [pathProgress]);

  // Reflection insight — surfaces the per-category counts as a visible
  // card so the user can see "the app actually read what I wrote." For
  // the longest time reflectionSignals only quietly biased the daily
  // challenge picker — invisible personalization is the same as no
  // personalization from the user's perspective. Threshold: at least 3
  // reflections AND a dominant category with >=3 hits (same gate as
  // dominantReflectionCategory).
  const reflectionInsight = useMemo(() => {
    const texts = collectReflectionTexts(pathProgress);
    if (texts.length < 3) return null;
    const weights = analyzeReflections(texts);
    const dominant = dominantReflectionCategory(weights);
    if (!dominant) return null;
    return {
      category: dominant,
      count: weights[dominant],
      totalReflections: texts.length,
    };
  }, [pathProgress]);

  // Past-reflection memory card. Picks one reflection from history
  // and resurfaces it as "you wrote this 12 lessons ago — here's
  // what you said". The investment-feedback loop: the user sees
  // their OWN words come back as evidence that what they put into
  // this app actually exists somewhere, isn't disappearing. Without
  // this surface, written reflections feel like notes thrown into a
  // void; with it, they feel like an archive being built. Picks
  // deterministically (date-bucketed) so the same memory shows for
  // the whole day instead of flickering between renders. Threshold:
  // need at least 5 total reflections so this never resurrects the
  // most recent one (would feel weird).
  const pastReflectionMemory = useMemo(() => {
    if (!pathProgress) return null;
    const all = [];
    for (const pid of Object.keys(pathProgress)) {
      const reflections = pathProgress[pid]?.reflections || {};
      for (const lessonId of Object.keys(reflections)) {
        const text = reflections[lessonId];
        if (text && text.trim().length >= 20) {
          all.push({ pathId: pid, lessonId, text: text.trim() });
        }
      }
    }
    if (all.length < 5) return null;
    // Skip the 2 most recent (assumed sort: lesson order ascending).
    // We want to pull from the "archive", not yesterday's reflection.
    const candidates = all.slice(0, Math.max(1, all.length - 2));
    // Day-bucketed deterministic pick so the same memory persists
    // through a session and rotates next day.
    const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const picked = candidates[dayBucket % candidates.length];
    const lessonOrder = parseInt(
      picked.lessonId.split('-').pop(),
      10,
    );
    return {
      pathId: picked.pathId,
      lessonOrder,
      text: picked.text,
      totalCount: all.length,
    };
  }, [pathProgress]);

  // Daily Plan — 3 lessons curated for the user today based on their
  // active path + reflection-derived focus + onboarding goal. Premium-
  // only feature; free users see a teaser/upsell version.
  // dailyPlan memo removed alongside the DailyPlanCard. The "smart
  // picks" surface never paid for the visual real estate it took —
  // LessonQueueCard already shows the next lesson in the path.

  // Personalised daily challenge — uses the user's onboarding goal +
  // reflection-derived dominant category to bias toward challenges
  // matching their actual state. Mood-check signal removed in the
  // Home agresif sadeleştirme pass (DailyMoodCheckIn card is gone).
  const dailyChallenge = useMemo(() => {
    const goalSignal = userProfile?.answers?.goal || null;
    const reflectionAsGoal = {
      detox: 'discipline',
      body: 'fitness',
      mind: 'focus',
      money: 'money',
    }[reflectionDominant];
    return getDailyChallenge(todayStr, {
      mood: userProfile?.answers?.mood || null,
      goal: reflectionAsGoal || goalSignal,
    });
  }, [todayStr, userProfile, reflectionDominant]);
  const dailyChallengeDone = dailyChallengeCompletedAt === todayStr;

  // Habit chain: last 7 days as a row of dots — filled = lesson done that
  // day, empty = missed. Loss-aversion visual: a half-broken chain hurts
  // more than a number that just dropped from 7 to 3.
  const chainDays = useMemo(() => {
    const out = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({
        key,
        active: !!(lessonHistory || {})[key],
        isToday: i === 0,
      });
    }
    return out;
  }, [lessonHistory]);

  // Time-limited paywall offer. Saturday/Sunday show "weekend deal" banner
  // pushing premium — nudges high-intent users on rest days. UI-only for
  // now; the actual price doesn't change in StoreKit.
  const isWeekendOffer = (() => {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  })();

  // One-shot alert when AppContext auto-burned a streak repair token because
  // the user missed yesterday but had a token to spare.
  useEffect(() => {
    if (!_streakFreezeToast) return;
    Alert.alert(
      t('streakFreeze.savedTitle', 'Streak kurtarıldı 🛡️'),
      t(
        'streakFreeze.savedBody',
        'Dün ders yapmamıştın ama bir streak onarım jetonu kullanıldı. {{count}} jetonun kaldı.',
        { count: streakFreezes },
      ),
      [{ text: 'OK', onPress: () => clearStreakFreezeToast() }],
    );
  }, [_streakFreezeToast, streakFreezes, clearStreakFreezeToast, t]);
  const { user } = useAuth();

  const [streakInfoVisible, setStreakInfoVisible] = useState(false);

  const activePath = useMemo(
    () => getPathById(activePathId) || PATHS[0],
    [activePathId],
  );

  const currentLesson = useMemo(
    () => getCurrentLesson(activePath, pathProgress),
    [activePath, pathProgress],
  );

  // Total lessons completed across all paths
  const totalCompleted = useMemo(() => {
    return Object.values(pathProgress || {}).reduce(
      (sum, p) => sum + (p?.completed?.length || 0),
      0,
    );
  }, [pathProgress]);

  const totalLessons = PATHS.reduce((s, p) => s + p.duration, 0);

  const handleStartLesson = () => {
    if (!currentLesson) return;
    attemptStartLesson(currentLesson.pathId, currentLesson.id);
  };

  // Existing users (App Store update from a build < 53) finished onboarding
  // before the ATT-then-init-ads flow existed, so AdMob never booted for
  // them. Run a one-shot guard on Home mount: if SDK still isn't ready,
  // request ATT (idempotent if already answered) then init the SDK.
  // For new installs onboarding already did this — isAdsReady() is true,
  // and this block no-ops.
  const adInitTriggeredRef = useRef(false);
  useEffect(() => {
    if (adInitTriggeredRef.current) return;
    if (isAdsReady()) return;
    adInitTriggeredRef.current = true;
    (async () => {
      try { await requestTrackingPermissionIfNeeded(); } catch {}
      try {
        await initAds();
        loadInterstitial().catch(() => {});
        loadRewarded().catch(() => {});
      } catch {}
    })();
  }, []);

  // One-tap cold open: returning users (3+ day streak who haven't done today's
  // lesson yet) skip the home tab and land directly in their next lesson.
  // We only fire once per cold start via a ref so that swiping back from the
  // lesson screen doesn't re-trigger the route. Hearts gate also applies —
  // a returning user with 0 hearts shouldn't be auto-bounced into a lesson
  // they can't make progress on; they should see Home first and decide.
  // Commitment-device pledge modal. Shown the first time Home renders
  // for a user whose active path doesn't yet have a pledge. We keep
  // a per-app-session "asked" flag so a user who taps Skip isn't
  // re-pestered on the same cold start, but the modal will return on
  // the next launch until they either write something or the path
  // changes. The pledge itself persists via pathPledges in AppContext.
  const [pledgeModalVisible, setPledgeModalVisible] = useState(false);
  const pledgeAskedRef = useRef(false);
  useEffect(() => {
    if (pledgeAskedRef.current) return;
    if (!activePathId) return;
    if (pathPledges?.[activePathId]) return; // already pledged
    // Wait a heartbeat so the modal slides in AFTER Home's first paint,
    // not during it (avoids a "screen flashed for a frame" feel).
    pledgeAskedRef.current = true;
    const id = setTimeout(() => setPledgeModalVisible(true), 600);
    return () => clearTimeout(id);
  }, [activePathId, pathPledges]);

  const autoRoutedRef = useRef(false);
  useEffect(() => {
    if (autoRoutedRef.current) return;
    if (todayCompleted) return;
    if (!currentLesson) return;
    if ((currentStreak || 0) < 3) return;
    if (!isPremium && (hearts || 0) <= 0) return;
    // Don't auto-route into a lesson while the pledge modal is up —
    // pledge takes priority on the very first session.
    if (pledgeModalVisible) return;
    autoRoutedRef.current = true;
    // Tiny delay so the home screen's first frame paints — avoids a jarring
    // jump that looks like a glitch.
    const id = setTimeout(() => {
      navigation.navigate('Lesson', {
        pathId: currentLesson.pathId,
        lessonId: currentLesson.id,
      });
    }, 250);
    return () => clearTimeout(id);
  }, [todayCompleted, currentLesson, currentStreak, navigation, isPremium, hearts]);

  // Prefer the user's actual name when we have one. Sources, in order:
  //   1. Onboarding profile name (user typed it)
  //   2. Onboarding answers.name (older builds stored it here)
  //   3. Supabase auth metadata (signup or Apple Sign-In full name)
  //   4. The local part of the email (e.g. "berk@x.com" -> "berk")
  //   5. Generic fallback string
  const profileName = userProfile?.name?.trim();
  const answerName = userProfile?.answers?.name?.trim();
  const metaName = user?.user_metadata?.name?.trim();
  const emailLocal = (user?.email || '').split('@')[0];
  const username =
    profileName ||
    answerName ||
    metaName ||
    (emailLocal ? capitalize(emailLocal) : t('home.greetingName', 'Disiplinci'));
  const greeting = getGreeting(t);

  // Hydration gate — surface a skeleton during the brief window between
  // AppContext mount and AsyncStorage hydration. Without this a
  // returning user briefly sees default-zero numbers (streak 0, level
  // 1) before their real state snaps in. The skeleton renders the
  // same shapes (greeting block + streak hero + chain + CTA) so the
  // reveal feels like content snapping in, not screen rebuilding.
  if (!_loaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          {/* Greeting block */}
          <Skeleton width={120} height={14} style={{ marginBottom: 8 }} />
          <Skeleton width={180} height={28} style={{ marginBottom: 14 }} />
          {/* Streak hero */}
          <Skeleton
            width="100%"
            height={120}
            borderRadius={20}
            style={{ marginBottom: 16 }}
          />
          {/* Habit chain */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} width={28} height={28} borderRadius={14} />
            ))}
          </View>
          {/* Daily Deck CTA */}
          <Skeleton
            width="100%"
            height={68}
            borderRadius={16}
            style={{ marginBottom: 12 }}
          />
          {/* Today's CTA card */}
          <Skeleton width="100%" height={140} borderRadius={20} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />

      <LightTopAppBar
        onAvatarPress={() => navigation.navigate('Settings')}
        onStreakPress={() => setStreakInfoVisible(true)}
        currentStreak={currentStreak}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingLabel}>{greeting}</Text>
          <Text style={styles.greetingName}>{username}</Text>
          {/* Archetype chip — the identity badge the user picked at
              onboarding. Surfacing it here makes the onboarding choice
              consequential: every Home open re-reads who they're
              becoming, which is the core identity-based-habits loop. */}
          {userProfile?.archetype ? (
            <View style={styles.archetypeChip}>
              <MaterialIcons
                name={getArchetypeById(userProfile.archetype).icon}
                size={12}
                color={getArchetypeById(userProfile.archetype).accent}
              />
              <Text style={styles.archetypeChipText}>
                {t(
                  getArchetypeById(userProfile.archetype).nameKey,
                  getArchetypeById(userProfile.archetype).nameFallback,
                )}
              </Text>
            </View>
          ) : null}
          {/* Active pledge — when the user has committed a sentence
              to this path, surface it as a quiet quote under their
              name. Commitment-device research: even just re-reading
              your own written promise reactivates the adherence loop. */}
          {pathPledges?.[activePathId] ? (
            <Text style={styles.pledgeQuote} numberOfLines={2}>
              "{pathPledges[activePathId]}"
            </Text>
          ) : null}
          <Text style={styles.greetingSubtitle}>
            {t(
              'home.subtitle',
              'Disiplin yolunda bir gün daha. Hadi başla.',
            )}
          </Text>
        </View>

        {/* Streak Hero Card */}
        <TouchableOpacity
          style={styles.streakHero}
          onPress={() => setStreakInfoVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.streakHeroLeft}>
            <Text style={styles.streakHeroLabel}>
              {t('home.currentStreak', 'MEVCUT SERİ')}
            </Text>
            <View style={styles.streakHeroNumberRow}>
              <Text style={styles.streakHeroNumber}>{currentStreak}</Text>
              <MaterialIcons
                name="local-fire-department"
                size={42}
                color={LT.primaryContainer}
              />
            </View>
            <Text style={styles.streakHeroSub}>
              {t('home.daysStrong', 'GÜN')}
            </Text>
          </View>
          <View style={styles.streakHeroRight}>
            <Text style={styles.streakBestLabel}>
              {t('home.longestStreak', 'EN UZUN')}
            </Text>
            <Text style={styles.streakBest}>{longestStreak || 0}</Text>
            <Text style={styles.streakBestSub}>
              {t('home.daysStrong', 'GÜN')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Empathy banner shown the first time the user opens Home
            after losing a real streak (>=3 days). Persists across app
            restarts; dismissed by tapping × or by starting a fresh
            lesson. The cold "STREAK: 1" reset moment is the textbook
            churn trigger in habit apps — this softens it.

            Streak Repair: if the rewarded-ad SDK is loaded we surface
            a secondary CTA that, on EARNED_REWARD, dispatches
            RESTORE_STREAK_FROM_REPAIR to put the lost streak back.
            Free users only — premium users would already have
            streakFreezes to absorb the miss; offering them a rewarded
            ad would be a worse experience than what their plan promises. */}
        {_streakLostInfo ? (
          <StreakLostBanner
            info={_streakLostInfo}
            repairAvailable={!isPremium && isAdsReady()}
            onRestart={() => {
              clearStreakLostInfo();
              if (currentLesson) {
                attemptStartLesson(currentLesson.pathId, currentLesson.id);
              }
            }}
            onRepair={async () => {
              try {
                const earned = await showRewarded();
                if (earned) {
                  restoreStreakFromRepair();
                  // Reload a fresh rewarded ad for the next eligible
                  // moment (other surfaces or another lost-streak event).
                  loadRewarded().catch(() => {});
                }
              } catch {
                // Ad failure is silent — the regular "Yeniden Başla"
                // CTA still works; user hasn't lost any option.
              }
            }}
            onDismiss={clearStreakLostInfo}
          />
        ) : null}

        {/* Habit chain — last 7 days */}
        <View style={styles.chainRow}>
          {chainDays.map((d) => (
            <View
              key={d.key}
              style={[
                styles.chainDot,
                d.active && styles.chainDotActive,
                d.isToday && styles.chainDotToday,
                d.isToday && d.active && styles.chainDotTodayActive,
              ]}
            />
          ))}
        </View>

        {/* Daily Deck CTA — bite-sized morning ritual (~3 minutes
            of 6 micro-cards). Hidden once today's deck is done so
            the user never taps into a stale deck. Sits above the
            reassessment card because it's a daily ritual; reassess
            is monthly. */}
        {lastDailyDeckCompletedDate !== todayDateStr ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DailyDeck')}
            style={styles.deckCard}
          >
            <View style={styles.deckIconBox}>
              <MaterialIcons
                name="auto-awesome"
                size={20}
                color={LT.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deckLabel}>
                {t('home.deckLabel', 'BUGÜNÜN DESTESİ · ~3 DK')}
              </Text>
              <Text style={styles.deckTitle}>
                {t(
                  'home.deckTitle',
                  'Stoik bir alıntı + 1 soru + 1 mikro eylem',
                )}
              </Text>
            </View>
            <MaterialIcons
              name="arrow-forward"
              size={18}
              color={LT.primary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.deckDoneChip}>
            <MaterialIcons
              name="check-circle"
              size={14}
              color={LT.onSurfaceVariant}
            />
            <Text style={styles.deckDoneChipText}>
              {t('home.deckDone', 'Bugünün destesi tamamlandı')}
            </Text>
          </View>
        )}

        {/* Re-assessment due — fires 30 days after baseline (or 30
            days after the latest assessment, whichever is later).
            This is the payoff surface for the whole Outcome
            Assessment system: the user sees "30 gün doldu, ölç" CTA,
            taps, fills the 1-minute form, then lands in the
            ProgressReport with their delta. */}
        {(() => {
          if (!baselineAssessment?.ts) return null;
          const lastTs = latestAssessment?.ts || baselineAssessment.ts;
          const daysSince = (Date.now() - lastTs) / (24 * 60 * 60 * 1000);
          if (daysSince < POST_ASSESSMENT_INTERVAL_DAYS) return null;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('Assessment', { mode: 'post' })
              }
              style={styles.reassessCard}
            >
              <View style={styles.reassessIconBox}>
                <MaterialIcons
                  name="insights"
                  size={20}
                  color={LT.onPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reassessLabel}>
                  {t('home.reassessLabel', '30 GÜN DOLDU')}
                </Text>
                <Text style={styles.reassessTitle}>
                  {t(
                    'home.reassessTitle',
                    'Tekrar ölç, ne kadar ilerlediğini gör',
                  )}
                </Text>
              </View>
              <MaterialIcons
                name="arrow-forward"
                size={20}
                color={LT.onPrimary}
              />
            </TouchableOpacity>
          );
        })()}

        {/* Today's session chip — shows the count of lessons completed
            within the current 30-min momentum window. The audit's
            "5 min then they leave" pattern is what we're fighting here:
            a visible "you did 2 today, the chain bonus is active"
            sticker makes the user want to keep stacking. Renders only
            when there's something to celebrate (>=1 lesson). */}
        {(todaySessionLessons || 0) > 0 ? (
          <View style={styles.sessionChip}>
            <MaterialIcons name="bolt" size={12} color={LT.primary} />
            <Text style={styles.sessionChipText}>
              {t('home.sessionToday', 'BUGÜN {{count}} DERS · MOMENTUM AKTİF', {
                count: todaySessionLessons,
              })}
            </Text>
          </View>
        ) : null}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PRIMARY ACTION ZONE — fold-above-the-fold content. The CTA
            used to be card #13 (out of ~18) on this screen; UX audit
            flagged it as the single biggest decision-fatigue source.
            Now: Greeting → Streak → Chain → CTA → Risk/Boost/Queue.
            Everything below the "BUGÜNÜN EKSTRALARI" divider is
            secondary and intentionally pushed past the first scroll.
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

        {/* Today's CTA Card — moved up from card #13 to card #4 */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaCardHeader}>
            <Text style={styles.ctaCardLabel}>
              {t('home.todayCta', 'BUGÜNÜN GÖREVİ')}
            </Text>
            <View style={styles.ctaPathBadge}>
              <MaterialIcons
                name={activePath.materialIcon}
                size={12}
                color={LT.onSurfaceVariant}
              />
              <Text style={styles.ctaPathBadgeText}>
                {t(`paths.${activePath.id}.shortTitle`, activePath.id)}
              </Text>
            </View>
          </View>
          <Text style={styles.ctaTitle}>
            {currentLesson
              ? t(
                  `lessons.${currentLesson.pathId}.${currentLesson.order}.title`,
                  `${t('path.lessonLabel', 'Ders')} ${currentLesson.order}`,
                )
              : t('home.allDone', 'Tüm dersleri tamamladın 🎉')}
          </Text>
          <Text style={styles.ctaDescription}>
            {currentLesson
              ? t(
                  `lessons.${currentLesson.pathId}.${currentLesson.order}.summary`,
                  t(
                    'home.ctaGenericSub',
                    'Bugünün adımı seni bekliyor. ~5 dakika.',
                  ),
                )
              : t(
                  'home.allDoneSub',
                  'Yeni yola geçebilir veya tekrar pratiği yapabilirsin.',
                )}
          </Text>
          {currentLesson ? (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleStartLesson}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaButtonText}>
                {t('home.startNow', 'PRATİĞE BAŞLA')}
              </Text>
              <MaterialIcons
                name="arrow-forward"
                size={20}
                color={LT.onPrimary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ctaButton, styles.ctaButtonSecondary]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Paths' })}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaButtonTextSecondary}>
                {t('home.viewPaths', 'YOLLARA GÖZAT')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Streak Risk Banner — loss-aversion prompt shown ONLY when
            (a) user has a streak >= 2, (b) today is not yet done,
            (c) it's 18:00+, (d) not on vacation. Self-gated, so it's
            safe to keep high on the screen — invisible most of the day. */}
        <StreakRiskBanner
          currentStreak={currentStreak}
          todayCompleted={todayCompleted}
          onVacation={!!vacationUntil && vacationUntil >= todayDateStr}
          onTapStart={() => {
            if (currentLesson) {
              attemptStartLesson(currentLesson.pathId, currentLesson.id);
            }
          }}
        />

        {/* Lesson Queue — direct path-progress surface; tapping a card
            opens the lesson in one tap. Right under the CTA so users
            who want to skip ahead can, without scrolling past extras. */}
        <LessonQueueCard
          activePathId={activePathId}
          pathProgress={pathProgress}
          onPressLesson={(pathId, lessonId) =>
            attemptStartLesson(pathId, lessonId)
          }
        />

        {/* Evening Insight card — only renders after 18:00 AND when the
            user has put in real work today (>=1 lesson). Pulls the
            "what did I do today" beat to the surface so the day's
            effort feels EARNED instead of just disappearing. The
            "<X% top group" framing is loss-aversion + status: the
            user closes the loop knowing their effort placed them
            somewhere measurable. Numbers are deliberate floor stats
            from Lally/Prochaska behaviour-change research — most
            users never do ANY discipline lesson, so a single completed
            session does put them above ~95% of the population. */}
        {(() => {
          const nowHour = new Date().getHours();
          if (nowHour < 18) return null;
          const lessonsToday = todaySessionLessons || 0;
          if (lessonsToday < 1) return null;
          const minutes = lessonsToday * 5;
          return (
            <View style={styles.eveningInsight}>
              <View style={styles.eveningInsightHeader}>
                <MaterialIcons
                  name="nightlight-round"
                  size={16}
                  color={LT.primaryContainer}
                />
                <Text style={styles.eveningInsightLabel}>
                  {t('home.eveningInsightLabel', 'GÜN ÖZETİN')}
                </Text>
              </View>
              <Text style={styles.eveningInsightTitle}>
                {t(
                  'home.eveningInsightTitle',
                  'Bugün {{count}} ders · ~{{minutes}} dk derin iş',
                  { count: lessonsToday, minutes },
                )}
              </Text>
              <Text style={styles.eveningInsightBody}>
                {lessonsToday >= 3
                  ? t(
                      'home.eveningInsightBodyHigh',
                      'Çoğu insan bugün hiç ders yapmadı. Sen 3+ yaptın — disiplinli %2nin içindesin.',
                    )
                  : lessonsToday === 2
                    ? t(
                        'home.eveningInsightBody2',
                        'Çoğu insan bugün hiç ders yapmadı. Sen 2 yaptın — disiplinli %5in içindesin.',
                      )
                    : t(
                        'home.eveningInsightBody1',
                        'Çoğu insan bugün hiç ders yapmadı. Sen 1 ders ile %10luk gruba katıldın — bu sıradan değil.',
                      )}
              </Text>
            </View>
          );
        })()}

        {/* Past Reflection Memory — investment-feedback surface. After
            the user has ≥5 reflections, this card resurfaces an old
            one as "you wrote this — remember?". Builds the sense of
            an archive being built, makes the writing feel like
            something that persists rather than evaporates. Tap →
            Reflections screen. */}
        {pastReflectionMemory ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Reflections')}
            style={styles.memoryCard}
          >
            <View style={styles.memoryHeader}>
              <MaterialIcons
                name="history-edu"
                size={16}
                color={LT.primaryContainer}
              />
              <Text style={styles.memoryLabel}>
                {t(
                  'home.memoryLabel',
                  'SENİN SÖZLERİN · {{total}} YANSIMA',
                  { total: pastReflectionMemory.totalCount },
                )}
              </Text>
            </View>
            <Text style={styles.memorySub} numberOfLines={1}>
              {t(
                `paths.${pastReflectionMemory.pathId}.title`,
                pastReflectionMemory.pathId,
              )}{' '}
              · {t('path.lessonLabel', 'Ders')}{' '}
              {pastReflectionMemory.lessonOrder}
            </Text>
            <Text style={styles.memoryText} numberOfLines={3}>
              "{pastReflectionMemory.text}"
            </Text>
            <Text style={styles.memoryFooter}>
              {t('home.memoryFooter', 'Tüm yansımalarına bak →')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            EXTRAS ZONE — secondary, mostly-optional engagement bait.
            Lives below the fold by design. Skipping any of these has
            zero impact on the core habit loop.
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Text style={styles.extrasHeader}>
          {t('home.extrasHeader', 'BUGÜNÜN EKSTRALARI')}
        </Text>

        {/* Daily Mystery Challenge — surfaces ONLY when today's deck
            isn't done yet OR is already complete; if user is mid-deck
            we hide this to avoid two "bugünün şeyi" surfaces competing
            for the same morning tap. Audit finding: Daily Deck and
            Daily Challenge were the same "today's thing" slot,
            splitting user attention. Now Challenge is the secondary
            extra — a bonus, not a parallel main quest. */}
        {dailyChallenge && lastDailyDeckCompletedDate === todayDateStr ? (
          <TouchableOpacity
            onPress={dailyChallengeDone ? undefined : () => completeDailyChallenge(DAILY_CHALLENGE_BONUS_XP)}
            activeOpacity={dailyChallengeDone ? 1 : 0.85}
            style={[
              styles.challengeCard,
              dailyChallengeDone && styles.challengeCardDone,
            ]}
          >
            <View style={styles.challengeIconBox}>
              <Text style={styles.challengeIcon}>{dailyChallenge.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.challengeLabel}>
                {dailyChallengeDone
                  ? t('home.challengeDone', 'BUGÜNÜN BONUSU TAMAMLANDI')
                  : t('home.challengeLabel', 'BUGÜNÜN BONUSU · +25 XP')}
              </Text>
              <Text style={styles.challengeTitle}>
                {t(dailyChallenge.titleKey, dailyChallenge.titleFallback)}
              </Text>
              <Text style={styles.challengeBody} numberOfLines={2}>
                {t(dailyChallenge.bodyKey, dailyChallenge.bodyFallback)}
              </Text>
            </View>
            {dailyChallengeDone ? (
              <MaterialIcons name="check-circle" size={26} color={LT.primaryContainer} />
            ) : (
              <MaterialIcons name="bolt" size={22} color={LT.primary} />
            )}
          </TouchableOpacity>
        ) : null}

        {/* Reflection Insight — only renders after ≥3 reflections AND a
            dominant category exists. "The app read me" trust hook. */}
        {reflectionInsight && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Reflections')}
            style={styles.insightCard}
          >
            <View style={styles.insightHeader}>
              <MaterialIcons
                name="auto-stories"
                size={18}
                color={LT.primaryContainer}
              />
              <Text style={styles.insightLabel}>
                {t('home.insightLabel', 'YANSIMALARIN BANA NE SÖYLEDİ')}
              </Text>
            </View>
            <Text style={styles.insightBody}>
              {t('home.insightBody', {
                count: reflectionInsight.count,
                total: reflectionInsight.totalReflections,
                category: t(
                  `home.insightCat.${reflectionInsight.category}`,
                  reflectionInsight.category,
                ),
                defaultValue:
                  '{{total}} yansımana baktım. En çok {{category}} konusunu yazıyorsun ({{count}} kez geçti). Bu sana bir şey söylüyor.',
              })}
            </Text>
          </TouchableOpacity>
        )}

        {/* Weekend Premium offer — only Sat/Sun, free users only. */}
        {isWeekendOffer && !isPremium ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Paywall')}
            activeOpacity={0.85}
            style={styles.weekendOffer}
          >
            <View style={styles.weekendOfferBadge}>
              <Text style={styles.weekendOfferBadgeText}>
                {t('home.weekendDeal', 'HAFTA SONU')}
              </Text>
            </View>
            <Text style={styles.weekendOfferText}>
              {t(
                'home.weekendOfferBody',
                'Premium ile streak donduruculari, sınırsız kalp, reklamsız.',
              )}
            </Text>
            <MaterialIcons name="arrow-forward" size={18} color={LT.onPrimary} />
          </TouchableOpacity>
        ) : null}

        {/* Quick Stats Strip */}
        <View style={styles.statsStrip}>
          <StatCell
            icon="bolt"
            label={t('home.statXp', 'XP')}
            value={totalXP.toLocaleString()}
          />
          <View style={styles.statDivider} />
          <StatCell
            icon="menu-book"
            label={t('home.statLessons', 'DERS')}
            value={`${totalCompleted}`}
            sub={`/ ${totalLessons}`}
          />
          <View style={styles.statDivider} />
          <StatCell
            icon="military-tech"
            label={t('home.statLevel', 'SEVİYE')}
            value={`${level}`}
          />
        </View>

        {/* Premium Upsell (free users) */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.premiumCard}
            onPress={() => navigation.navigate('Paywall')}
            activeOpacity={0.9}
          >
            <View style={styles.premiumCardLeft}>
              <View style={styles.premiumCardIcon}>
                <MaterialIcons
                  name="workspace-premium"
                  size={20}
                  color={LT.onPrimary}
                />
              </View>
              <View style={styles.premiumCardText}>
                <Text style={styles.premiumCardTitle}>
                  {t('home.premiumTitle', 'Premium ile sınırları kaldır')}
                </Text>
                <Text style={styles.premiumCardSub}>
                  {t(
                    'home.premiumSub',
                    'Reklamsız · Tüm yollar · Streak donduru · İndirim',
                  )}
                </Text>
              </View>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={LT.primaryContainer}
            />
          </TouchableOpacity>
        )}

        {/* Quick Links */}
        <View style={styles.linkList}>
          <LinkRow
            icon="auto-stories"
            label={t('home.linkReflections', 'Yansımalarım')}
            sub={t('home.linkReflectionsSub', 'Geçmiş ders yansımaları')}
            onPress={() => navigation.navigate('Reflections')}
          />
          <LinkRow
            icon="settings"
            label={t('home.linkSettings', 'Ayarlar')}
            sub={t('home.linkSettingsSub', 'Bildirim, ses, hesap')}
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <BannerAdBox />

      <StreakInfoModal
        visible={streakInfoVisible}
        onClose={() => setStreakInfoVisible(false)}
        currentStreak={currentStreak}
      />

      {/* Commitment-Device pledge — first Home open per active path.
          Persisted in pathPledges (synced via cloudSync). Re-opens on
          subsequent cold starts if the user dismissed without writing,
          until they either commit or change paths. */}
      <PledgeModal
        visible={pledgeModalVisible}
        pathTitle={t(`paths.${activePathId}.title`, activePathId)}
        onSubmit={(text) => {
          setPathPledge(activePathId, text);
          setPledgeModalVisible(false);
        }}
        onSkip={() => setPledgeModalVisible(false)}
      />

      {/* OutOfHearts gate — fires when a free user with 0 hearts tries
          to start a lesson from any Home entry point (today CTA, lesson
          queue card, 3+ streak auto-route). Routes them to watch a
          rewarded ad, go premium, or wait for the timer. */}
      <OutOfHeartsModal
        visible={outOfHeartsVisible}
        refillAt={heartsRefillAt}
        onClose={() => setOutOfHeartsVisible(false)}
        onRefill={() => {
          refillHearts();
          setOutOfHeartsVisible(false);
        }}
        onPaywall={() => {
          setOutOfHeartsVisible(false);
          navigation.navigate('Paywall');
        }}
      />
    </SafeAreaView>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCell({ icon, label, value, sub }) {
  return (
    <View style={styles.statCell}>
      <MaterialIcons name={icon} size={16} color={LT.onSurfaceVariant} />
      <Text style={styles.statValue}>
        {value}
        {sub ? <Text style={styles.statValueSub}> {sub}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LinkRow({ icon, label, sub, onPress }) {
  return (
    <TouchableOpacity
      style={styles.linkRow}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.linkIconWrap}>
        <MaterialIcons name={icon} size={20} color={LT.primaryContainer} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Text style={styles.linkSub}>{sub}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={LT.outline} />
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(t) {
  const hour = new Date().getHours();
  if (hour < 5) return t('home.greetingNight', 'GECE YARISI');
  if (hour < 12) return t('home.greetingMorning', 'GÜNAYDIN');
  if (hour < 18) return t('home.greetingAfternoon', 'İYİ ÖĞLEDEN SONRALAR');
  return t('home.greetingEvening', 'İYİ AKŞAMLAR');
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LT.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  greetingBlock: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 28,
    paddingBottom: 16,
  },
  greetingLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
    marginBottom: 4,
  },
  greetingName: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: LT.onSurface,
    marginBottom: 6,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    lineHeight: 20,
  },
  // Identity badge — small pill between name and subtitle. Keep it
  // subdued: it's an echo of the user's onboarding choice, not a status.
  archetypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: LT.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  archetypeChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: LT.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  // "Bugün X ders" momentum chip — sits between the 7-day habit chain
  // and the primary CTA. Subdued red to read as a status pill, not
  // a CTA — it celebrates progress without pulling focus from the
  // actual "next lesson" button below it.
  // Daily Deck entry — softer than the reassess CTA (which is once
  // a month and bold). Daily Deck is everyday so it's quieter, but
  // still warmer than the extras list.
  deckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  deckIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 38, 38, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.primary,
    marginBottom: 2,
  },
  deckTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: LT.onSurface,
  },
  // Post-completion chip — small, just a "you did it" acknowledgement.
  deckDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: LT.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 12,
  },
  deckDoneChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
  },
  // 30-day re-assessment CTA — full-width primary-colored card.
  // Bold by design: this is the highest-leverage retention moment
  // we have (the "look how far you've come" payoff), so it visually
  // outranks everything except the active CTA.
  reassessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.primary,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  reassessIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reassessLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  reassessTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: LT.onPrimary,
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: 'rgba(220, 38, 38, 0.22)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 12,
    marginBottom: -4,
  },
  sessionChipText: {
    fontSize: 11,
    fontWeight: '900',
    color: LT.primary,
    letterSpacing: 0.6,
  },
  // Evening Insight card — quiet, dark-mode-adjacent card that
  // shows the day's effort in a "you placed in top X%" framing.
  // Only renders after 18:00 + ≥1 lesson, so it's never a dead card.
  eveningInsight: {
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  eveningInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  eveningInsightLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.primaryContainer,
  },
  eveningInsightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 6,
  },
  eveningInsightBody: {
    fontSize: 13,
    color: LT.onSurfaceVariant,
    lineHeight: 18,
  },
  // Memory card — "Senin sözlerin" investment-feedback surface.
  // Card uses primaryContainer border so it feels warmer than the
  // neutral extras below, signalling "this is YOUR content" not
  // "another upsell".
  memoryCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.20)',
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  memoryLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.primaryContainer,
  },
  memorySub: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    marginBottom: 8,
  },
  memoryText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: LT.onSurface,
    lineHeight: 20,
    marginBottom: 10,
  },
  memoryFooter: {
    fontSize: 11,
    fontWeight: '800',
    color: LT.primary,
    letterSpacing: 0.4,
  },
  // The user's own commitment sentence echoed back under their name.
  // Italic + softer color to feel like a quote, not a heading.
  pledgeQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: LT.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: LT.outlineVariant,
  },

  // Streak Hero card
  streakHero: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  streakHeroLeft: {
    flex: 1.4,
  },
  streakHeroLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
    marginBottom: 6,
  },
  streakHeroNumberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  streakHeroNumber: {
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: -2.5,
    color: LT.primaryContainer,
    lineHeight: 64,
  },
  streakHeroSub: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    color: LT.outline,
    marginTop: 2,
  },
  streakHeroRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: LT.outlineVariant,
    paddingLeft: 16,
  },
  streakBestLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
  },
  streakBest: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: LT.onSurface,
    marginTop: 2,
  },
  streakBestSub: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.outline,
  },

  // Today's CTA card
  chainRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
  },
  chainDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: LT.outlineVariant,
  },
  chainDotActive: {
    backgroundColor: LT.primary,
  },
  chainDotToday: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: LT.primary,
    backgroundColor: 'transparent',
  },
  chainDotTodayActive: {
    backgroundColor: LT.primary,
  },

  weekendOffer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.primary,
    borderRadius: LT_RADIUS.lg,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  weekendOfferBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  weekendOfferBadgeText: {
    color: LT.onPrimary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  weekendOfferText: {
    flex: 1,
    color: LT.onPrimary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 12,
    padding: 14,
    borderRadius: LT_RADIUS.xl,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.primary,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  challengeCardDone: {
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainer,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Divider label between the primary action zone (Streak/CTA/Queue)
  // and the optional engagement extras. Visual breath + signals to the
  // user that what's below is "more stuff, take it or leave it" — not
  // another required action.
  extrasHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.onSurfaceVariant,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  challengeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LT.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeIcon: { fontSize: 22 },
  challengeLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.primary,
    marginBottom: 2,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  challengeBody: {
    fontSize: 12,
    color: LT.onSurfaceVariant,
    fontWeight: '500',
    lineHeight: 16,
  },

  // Reflection-insight card: surfaces the substring-matcher's findings
  // back to the user. Soft red left border keeps brand presence without
  // shouting; the whole card is tappable to route to the Reflections list.
  insightCard: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderLeftWidth: 4,
    borderLeftColor: LT.primaryContainer,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  insightLabel: {
    color: LT.primaryContainer,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  insightBody: {
    color: LT.onSurface,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  ctaCard: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 2,
    borderColor: LT.primaryContainer,
    padding: 20,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
  },
  ctaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ctaCardLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.primaryContainer,
  },
  ctaPathBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  ctaPathBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: LT.onSurfaceVariant,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: LT.onSurface,
    lineHeight: 28,
    marginBottom: 6,
  },
  ctaDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    lineHeight: 19,
    marginBottom: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LT.primaryContainer,
    height: 48,
    borderRadius: LT_RADIUS.lg,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaButtonText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  ctaButtonTextSecondary: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 14,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: LT.outlineVariant,
    marginVertical: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: LT.onSurface,
    letterSpacing: -0.4,
  },
  statValueSub: {
    fontSize: 11,
    fontWeight: '700',
    color: LT.outline,
    letterSpacing: 0,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
  },

  // Premium upsell card
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: 'rgba(227, 18, 18, 0.06)',
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
    padding: 16,
  },
  premiumCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LT.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  premiumCardText: {
    flex: 1,
  },
  premiumCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: LT.onSurface,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  premiumCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
  },

  // Link list
  linkList: {
    marginHorizontal: LT_SPACING.containerMargin,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: LT.onSurface,
    marginBottom: 2,
  },
  linkSub: {
    fontSize: 12,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
  },
});
