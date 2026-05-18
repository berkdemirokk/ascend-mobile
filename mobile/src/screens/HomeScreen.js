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
import TodayHeroCard from '../components/TodayHeroCard';
import WhatToDoCard from '../components/WhatToDoCard';
import DailyRitualsCarousel from '../components/DailyRitualsCarousel';
import YourWhyCard from '../components/YourWhyCard';
import CustomGoalCard from '../components/CustomGoalCard';
import AdaptiveCoachCard from '../components/AdaptiveCoachCard';
import { REWARDS as MYSTERY_REWARDS } from '../components/DailyMysteryBox';
import { getAdaptiveSuggestion } from '../services/adaptiveCoach';
import StreakRiskBanner from '../components/StreakRiskBanner';
import WeekendBoostBanner from '../components/WeekendBoostBanner';
import OutOfHeartsModal from '../components/OutOfHeartsModal';
import { generateDailyPlan } from '../services/dailyPlanGenerator';
import {
  requestTrackingPermissionIfNeeded,
  initAds,
  loadInterstitial,
  loadRewarded,
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
import { getFirstName } from '../services/displayName';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';
import { useAppMood } from '../hooks/useAppMood';

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const {
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
    streakFreezes,
    clearStreakFreezeToast,
    dailyChallengeCompletedAt,
    completeDailyChallenge,
    dailyMysteryBoxOpenedAt,
    dailyMysteryBoxLastReward,
    openMysteryBox,
    dailyMoodCheckInDate,
    dailyMoodCheckInValue,
    setDailyMood,
    vacationUntil,
    hearts,
    heartsRefillAt,
    refillHearts,
    earnHeart,
    dailyLessonsCount,
    dailyGoalTarget,
    userWhy,
    setUserWhy,
    anonUsername,
    customGoal,
    setCustomGoal,
    clearCustomGoal,
    checkInCustomGoal,
    setActivePath,
    middayPauseCompletedAt,
    eveningCloseCompletedAt,
    tomorrowIntent,
    friendPair,
  } = useApp();

  // Day-bucket booleans for the per-day cards. Stable across re-renders
  // within the same day.
  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const mysteryBoxOpenedToday = dailyMysteryBoxOpenedAt === todayDateStr;
  const moodPickedToday = dailyMoodCheckInDate === todayDateStr
    ? dailyMoodCheckInValue
    : null;

  // Midday Pause pill visibility — only between 12:00 and 16:00 local
  // time. Two states:
  //   • Waiting: not done today → prominent pill, taps into the modal.
  //   • Done:    completed today → soft check pill, still tappable
  //     (user can re-enter to read the quote / re-breathe) but visually
  //     subordinated so it doesn't fight with TodayHeroCard.
  // Outside the window the pill hides entirely so Home stays clean.
  const middayHour = new Date().getHours();
  const middayWindowOpen = middayHour >= 12 && middayHour < 16;
  const middayDoneToday = middayPauseCompletedAt === todayDateStr;
  const showMiddayPill = middayWindowOpen;

  // Evening Close pill visibility — only between 18:00 and 22:30 local
  // time. Same two-state pattern as Midday: prominent when waiting,
  // soft check when done. The window starts earlier than 20:30 so an
  // early-evening user sees the affordance before the push fires.
  // 22:30 cutoff keeps it off Home after the practical "go to bed"
  // window has closed.
  const eveningNow = new Date();
  const eveningHour = eveningNow.getHours();
  const eveningMinute = eveningNow.getMinutes();
  // 18:00 ≤ now < 22:30. Mapped to integer minutes-since-midnight for
  // a single clean comparison.
  const eveningMins = eveningHour * 60 + eveningMinute;
  const eveningWindowOpen = eveningMins >= 18 * 60 && eveningMins < 22 * 60 + 30;
  const eveningDoneToday = eveningCloseCompletedAt === todayDateStr;
  const showEveningPill = eveningWindowOpen;

  // Per-session adaptive coach dismiss. Once dismissed, the banner
  // hides until the next app launch (not persisted) — so the user
  // isn't pestered, but a fresh signal can re-surface tomorrow.
  const [adaptiveDismissed, setAdaptiveDismissed] = useState(false);

  // Compute the adaptive suggestion off pathProgress + activePathId.
  // Memoized so we only recompute when one of those actually changes;
  // the hot path is cheap (5-element rolling avg) but useMemo keeps
  // child renders stable.
  const adaptiveSuggestion = useMemo(
    () =>
      getAdaptiveSuggestion({
        pathProgress,
        activePathId,
        isPremium,
      }),
    [pathProgress, activePathId, isPremium],
  );

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

  // Daily Plan — 3 lessons curated for the user today based on their
  // active path + reflection-derived focus + onboarding goal. Premium-
  // only feature; free users see a teaser/upsell version.
  const dailyPlan = useMemo(() => {
    if (!isPremium) return null;
    return generateDailyPlan({
      pathProgress,
      activePathId,
      goal: userProfile?.answers?.goal || null,
      reflectionDominant,
      mood: moodPickedToday || userProfile?.answers?.mood || null,
    });
  }, [isPremium, pathProgress, activePathId, userProfile, reflectionDominant, moodPickedToday]);

  // Personalised daily challenge — uses the user's mood + goal signals
  // AND reflection-derived dominant category to bias toward challenges
  // that match their actual state. Signal priority (most specific wins):
  //   1. Today's mood check-in (lived state today)
  //   2. Onboarding mood (stated baseline)
  //   3. Reflection-derived goal (lived behavior over time)
  //   4. Onboarding goal (stated baseline)
  const dailyChallenge = useMemo(() => {
    const moodSignal = moodPickedToday || userProfile?.answers?.mood || null;
    const goalSignal = userProfile?.answers?.goal || null;
    // Map reflection dominant category back into a goal-like signal so
    // getDailyChallenge can keep using its existing GOAL_CATEGORY_PREFS
    // table. detox/body/mind/money each correspond 1:1 to an onboarding
    // goal. (social has no goal equivalent; we just leave the original
    // goal in that case.)
    const reflectionAsGoal = {
      detox: 'discipline',
      body: 'fitness',
      mind: 'focus',
      money: 'money',
    }[reflectionDominant];
    return getDailyChallenge(todayStr, {
      mood: moodSignal,
      goal: reflectionAsGoal || goalSignal,
    });
  }, [todayStr, userProfile, reflectionDominant, moodPickedToday]);
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

  // Time-aware UI mood — drives a subtle full-screen tint overlay (and,
  // later, copy tone). See hooks/useAppMood.js for the hour→palette
  // table. Re-evaluates every 10 minutes so the night palette kicks in
  // for users who keep the app open past 22:00.
  const mood = useAppMood({ currentStreak, totalCompleted });

  const totalLessons = PATHS.reduce((s, p) => s + p.duration, 0);

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
  const autoRoutedRef = useRef(false);
  useEffect(() => {
    if (autoRoutedRef.current) return;
    if (todayCompleted) return;
    if (!currentLesson) return;
    if ((currentStreak || 0) < 3) return;
    if (!isPremium && (hearts || 0) <= 0) return;
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
  //   1. Onboarding profile (user typed it)
  //   2. Supabase auth metadata (signup or Apple Sign-In full name)
  //   3. The local part of the email (e.g. "berk@x.com" -> "berk")
  //   4. Generic fallback string
  // Display name resolution centralized in services/displayName.js
  // so every surface (Home, Lesson, Notifications, Mirror) addresses
  // the user by the SAME name with the SAME priority order.
  const username = getFirstName({
    userProfile,
    user,
    anonUsername,
    fallback: t('home.greetingName', 'Disiplinci'),
  });
  const greeting = getGreeting(t);
  // Stoic conditional subtitle. Reads `currentStreak` and
  // `totalCompleted` from context so a returning user with prior
  // progress doesn't get the same "first day" line as a brand-new
  // install. Falls back to the original generic line — same JSX
  // slot, only the text changes.
  //
  // HIGHEST-PRIORITY branch: when the user picked a "tomorrow intent"
  // during last night's Evening Close and `today` matches that
  // intent's target date, surface it as the subtitle. This is the
  // hand-off that closes the daily ritual cycle: the user's own
  // commitment from yesterday greets them this morning.
  const subtitleText = (() => {
    const hour = new Date().getHours();
    const streak = currentStreak || 0;
    const completed = totalCompleted || 0;
    // Tomorrow-intent hand-off — fire only in the morning so the line
    // doesn't compete with the streak-risk evening branches. We treat
    // "morning" generously (before 18:00) to handle late risers.
    if (
      tomorrowIntent
      && tomorrowIntent.date === todayDateStr
      && hour < 18
    ) {
      const intentLabelMap = {
        discipline: t('eveningClose.intentDiscipline', 'Disiplin'),
        focus: t('eveningClose.intentFocus', 'Odak'),
        calm: t('eveningClose.intentCalm', 'Sakinlik'),
      };
      const intentLabel = intentLabelMap[tomorrowIntent.intent];
      if (intentLabel) {
        return t(
          'home.intentSubtitle',
          'Bugün için niyetin: {{intent}}.',
          { intent: intentLabel },
        );
      }
    }
    if (streak === 0 && completed === 0) {
      return t(
        'home.subtitleColdStart',
        'Bugün hiçbir şey yapmadın. Yarına geçmek için bahane hazır mı?',
      );
    }
    if (streak === 0 && completed > 0) {
      return t(
        'home.subtitleReturned',
        'Geri döndün. Bu da bir şey. Şimdi otur.',
      );
    }
    if (streak >= 7 && hour < 10) {
      return t(
        'home.subtitleEarlyDisciplined',
        'Erken kalktın. Çoğu kalkmaz.',
      );
    }
    if (hour >= 23 || hour < 5) {
      return t(
        'home.subtitleLateNight',
        'Saat geç. Sessizlik, başkasının yapmadığı disiplindir.',
      );
    }
    return t('home.subtitle', 'Disiplin yolunda bir gün daha. Hadi başla.');
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Time-aware mood tint — additive overlay, never intercepts touches.
          zIndex 0 keeps it behind every existing child (they layer naturally
          via DOM order). */}
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
          <Text style={styles.greetingSubtitle}>{subtitleText}</Text>
        </View>

        {/* Midday Pause pill — small affordance between 12:00 and 16:00.
            Two states: waiting (red, prominent) and done (muted check).
            Outside the window the pill hides entirely so Home is clean
            for the rest of the day. Doesn't replace existing copy —
            slots in as a ~32px-tall row between greeting and TodayHero. */}
        {showMiddayPill ? (
          <TouchableOpacity
            style={[
              styles.middayPill,
              middayDoneToday && styles.middayPillDone,
            ]}
            onPress={() => navigation.navigate('MiddayPause')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.middayPillText,
                middayDoneToday && styles.middayPillTextDone,
              ]}
            >
              {middayDoneToday
                ? t('midday.middayCompletePill', '✓ Öğle Molası tamam')
                : t('midday.middayWaitingPill', '🕐 Öğle Molası bekliyor')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Evening Close pill — mirror of the Midday pill but for the
            18:00-22:30 window. Same two-state pattern: prominent when
            waiting, soft check when done. Taps into the EveningClose
            modal where the user closes the daily ritual cycle. */}
        {showEveningPill ? (
          <TouchableOpacity
            style={[
              styles.middayPill,
              eveningDoneToday && styles.middayPillDone,
            ]}
            onPress={() => navigation.navigate('EveningClose')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.middayPillText,
                eveningDoneToday && styles.middayPillTextDone,
              ]}
            >
              {eveningDoneToday
                ? t('eveningClose.pillDone', '✓ Günü kapattın')
                : t('eveningClose.pillWaiting', '🌙 Günü kapat (3 dk)')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* TodayHeroCard — merges streak hero + 7-day chain + daily goal
            into a single block. Replaces three previously stacked cards
            so the Home feed leads with one focused "today" status pane. */}
        <TodayHeroCard
          currentStreak={currentStreak}
          longestStreak={longestStreak || 0}
          chainDays={chainDays}
          dailyLessonsCount={dailyLessonsCount}
          dailyGoalTarget={dailyGoalTarget}
          onPress={() => setStreakInfoVisible(true)}
        />

        {/* "Your Why" pinned card — the user's own self-stated reason
            for being here. Strongest emotional re-engagement surface
            in the app; user sees their past commitment every open. */}
        <YourWhyCard userWhy={userWhy} onSave={setUserWhy} />

        {/* Weekend Premium offer — only Sat/Sun, nudges high-intent users */}
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

        {/* WhatToDoCard — single "start a lesson" surface. Internally
            switches between premium daily plan, free CTA, and all-done
            celebration. Replaces DailyPlanCard + LessonQueueCard +
            inline Today's CTA section. */}
        <WhatToDoCard
          isPremium={isPremium}
          plan={dailyPlan}
          currentLesson={currentLesson}
          activePath={activePath}
          pathProgress={pathProgress}
          onStartLesson={(pathId, lessonId) =>
            attemptStartLesson(pathId, lessonId)
          }
          onViewPaths={() =>
            navigation.navigate('MainTabs', { screen: 'Paths' })
          }
          onUpgradeTap={() => navigation.navigate('Paywall')}
        />

        {/* Weekend Boost Banner — only renders Sat/Sun. Premium: gold
            "active" celebration banner. Free: pink upsell CTA → paywall. */}
        <WeekendBoostBanner
          isPremium={isPremium}
          onUpgradeTap={() => navigation.navigate('Paywall')}
        />

        {/* Streak Risk Banner — loss-aversion prompt shown ONLY when
            (a) user has a streak >= 2, (b) today is not yet done,
            (c) it's 18:00+, (d) not on vacation. */}
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

        {/* DailyRitualsCarousel — horizontally swipeable row that merges
            four previously full-width cards (daily challenge, mystery
            box, mood check-in, daily quote). Each tile preserves its
            core action; the carousel just stacks them horizontally so
            the Home feed reclaims ~600px of vertical space. */}
        <DailyRitualsCarousel
          challenge={dailyChallenge}
          challengeDone={dailyChallengeDone}
          onCompleteChallenge={() =>
            completeDailyChallenge(DAILY_CHALLENGE_BONUS_XP)
          }
          alreadyOpenedBox={mysteryBoxOpenedToday}
          lastReward={dailyMysteryBoxLastReward}
          rewards={MYSTERY_REWARDS}
          onOpenBox={openMysteryBox}
          todayMood={moodPickedToday}
          onPickMood={setDailyMood}
          moodOptions={[
            { id: 'motivated', emoji: '🔥' },
            { id: 'fresh', emoji: '☀️' },
            { id: 'lost', emoji: '😶‍🌫️' },
          ]}
        />

        {/* Friend Code pill — single line, two states:
              • unpaired: invite-style "🤝 Disiplin ortağı bul"
              • paired:   live "🔥 [partner]: N gün"
            Taps into the FriendCode modal in both cases. */}
        <TouchableOpacity
          style={[
            styles.friendPill,
            friendPair && styles.friendPillPaired,
          ]}
          onPress={() => navigation.navigate('FriendCode')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.friendPillText,
              friendPair && styles.friendPillTextPaired,
            ]}
            numberOfLines={1}
          >
            {friendPair
              ? t('friendCode.homePillPaired', '🔥 {{name}}: {{streak}} gün', {
                  name: friendPair.partnerName,
                  streak: friendPair.partnerStreak || 0,
                })
              : t('friendCode.homePillUnpaired', '🤝 Disiplin ortağı bul')}
          </Text>
          <MaterialIcons
            name="chevron-right"
            size={18}
            color={friendPair ? LT.onSurface : LT.onPrimary}
          />
        </TouchableOpacity>

        {/* Adaptive Coach — reads rolling quiz accuracy and surfaces a
            mastery nudge ("try a harder path") or a "slow down" reminder
            ("re-read before pushing forward"). Per-session dismissible. */}
        {!adaptiveDismissed && adaptiveSuggestion ? (
          <AdaptiveCoachCard
            suggestion={adaptiveSuggestion}
            onSwitchPath={(pid) => {
              if (pid) setActivePath(pid);
              navigation.navigate('MainTabs', { screen: 'Paths' });
            }}
            onOpenPaths={() =>
              navigation.navigate('MainTabs', { screen: 'Paths' })
            }
            onDismiss={() => setAdaptiveDismissed(true)}
          />
        ) : null}

        {/* Custom Personal Goal — user-defined target alongside the
            curriculum. Empty state = soft prompt; active state = progress
            bar + daily check-in. Biggest single "this app knows me" lever. */}
        <CustomGoalCard
          customGoal={customGoal}
          onSave={setCustomGoal}
          onCheckIn={checkInCustomGoal}
          onClear={clearCustomGoal}
        />

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

      {/* OutOfHearts gate — fires when a free user with 0 hearts tries
          to start a lesson from any Home entry point (today CTA, lesson
          queue card, 3+ streak auto-route). Routes them to watch a
          rewarded ad, go premium, or wait for the timer. */}
      <OutOfHeartsModal
        visible={outOfHeartsVisible}
        refillAt={heartsRefillAt}
        onClose={() => setOutOfHeartsVisible(false)}
        onRefill={() => {
          // Rewarded-ad path → +1 heart only (capped at 5). Watching
          // an ad shouldn't reset the heart pool to full — it should
          // reward one continuation, matching Duolingo's model.
          earnHeart();
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

  // Midday Pause pill — small (~32px), sits between greeting and TodayHero
  middayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingHorizontal: 14,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 12,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.primaryContainer,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  middayPillDone: {
    // Less prominent once the user is done — soft surface, no shadow,
    // hairline border. Still tappable so they can re-enter the screen.
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  middayPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
  middayPillTextDone: {
    color: LT.onSurfaceVariant,
  },

  // Friend Code pill — sits below DailyRitualsCarousel. Two states:
  // unpaired (filled red, prompts the user to invite) and paired (soft
  // surface, shows partner's streak). Single line by design — the
  // accountability surface is "look how they're doing", not a feed.
  friendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.primaryContainer,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  friendPillPaired: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    shadowOpacity: 0,
    elevation: 0,
  },
  friendPillText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: LT.onPrimary,
  },
  friendPillTextPaired: {
    color: LT.onSurface,
  },
});
