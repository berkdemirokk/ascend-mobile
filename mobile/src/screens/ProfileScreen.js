// ProfileScreen — "Sen" tab in the redesigned 4-tab nav.
// Vivid Impact light theme. Avatar + level progress, rank badge,
// stats grid, achievements horizontal scroll, streak heatmap, share + reflections.

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  Share,
} from 'react-native';
import {
  AccessibleTouchableOpacity as TouchableOpacity,
} from '../components/AccessibleControls';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { LEGAL, LEVEL_THRESHOLDS, getNextLevel } from '../config/constants';
import { ACHIEVEMENTS, getEarnedIdentityBadges } from '../config/achievements';
import StreakHeatmap from '../components/StreakHeatmap';
import CharacterHero from '../components/CharacterHero';
import TransformationReportModal from '../components/TransformationReportModal';
import {
  buildTransformationReport,
  reportEligible,
} from '../services/transformationReport';
import { PATHS } from '../data/paths';
import { getCurrentLanguage } from '../i18n';
import { getRank, getNextRank } from '../config/ranks';
import StreakCalendar from '../components/StreakCalendar';
import AchievementDetailModal from '../components/AchievementDetailModal';
import StreakShareCard from '../components/StreakShareCard';
import { captureAndShare } from '../services/streakShare';
import LightTopAppBar from '../components/LightTopAppBar';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

// Extracted modular subcomponents
import CircularProgress from '../components/profile/CircularProgress';
import ProfileStatCard from '../components/profile/ProfileStatCard';
import LevelProgressCard from '../components/profile/LevelProgressCard';
import IdentityBadgesSection from '../components/profile/IdentityBadgesSection';
import PathMasterySection from '../components/profile/PathMasterySection';
import ProfileAchievementsSection from '../components/profile/ProfileAchievementsSection';

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const appState = useApp();

  const {
    totalXP = 0,
    level = 1,
    currentStreak = 0,
    longestStreak = 0,
    pathProgress = {},
    unlockedAchievements = [],
    lessonHistory = {},
    anonUsername = null,
    isPremium = false,
    completedPathsCount = 0,
    rank: appRank = null,
  } = appState || {};
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const shareCardRef = useRef(null);

  const transformationReport = useMemo(
    () => (reportEligible(appState) ? buildTransformationReport(appState) : null),
    [appState],
  );

  const completedLessonsTotal = useMemo(() => {
    return Object.values(pathProgress || {}).reduce(
      (sum, p) => sum + (p?.completed?.length || 0),
      0,
    );
  }, [pathProgress]);

  const completedPaths = completedPathsCount;
  const rank = appRank || getRank(completedPaths);
  const nextRank = useMemo(
    () => getNextRank(completedPaths),
    [completedPaths],
  );

  const nextLevel = useMemo(() => getNextLevel(level), [level]);
  const currentLevelThreshold =
    LEVEL_THRESHOLDS.find((tier) => tier.level === level)?.xpRequired ?? 0;
  const nextLevelThreshold = nextLevel?.xpRequired ?? currentLevelThreshold;
  const xpInLevel = totalXP - currentLevelThreshold;
  const xpForNext = Math.max(1, nextLevelThreshold - currentLevelThreshold);
  const levelPercent = Math.min(
    100,
    Math.round((xpInLevel / xpForNext) * 100),
  );

  const identityBadges = useMemo(
    () => getEarnedIdentityBadges(pathProgress, PATHS, getCurrentLanguage?.() || 'tr'),
    [pathProgress, i18n.resolvedLanguage],
  );

  const recentAchievements = useMemo(() => {
    const unlocked = (unlockedAchievements || []).slice(0, 3);
    const lockedCandidates = ACHIEVEMENTS.filter(
      (a) => !unlocked.includes(a.id),
    ).slice(0, 4 - unlocked.length);
    return [
      ...unlocked.map((id) => ({ id, locked: false })),
      ...lockedCandidates.map((a) => ({ id: a.id, locked: true })),
    ];
  }, [unlockedAchievements]);

  const username = user?.email?.split('@')[0] || 'Ascender';

  const handleSharePublicProfile = async () => {
    const handle = anonUsername || 'ascender';
    const link = `${LEGAL.PUBLIC_APP_URL}?profile=${encodeURIComponent(handle)}`;
    const message = t(
      'profile.publicShareMessage',
      "Ascend'de profilim 🔥\n{{streak}} gün streak · {{xp}} XP · seviye {{level}}\n{{link}}",
      { streak: currentStreak, xp: totalXP, level, link },
    );
    try {
      await Share.share({ message });
    } catch {}
  };

  const handleShareStreak = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const message =
        currentStreak > 0
          ? t('share.streakActive', 'Ascend: Daily Discipline serim {{streak}} gündür sürüyor.', {
              streak: currentStreak,
            })
          : t('share.streakStart', 'Ascend: Daily Discipline ile ilk günümü başlatıyorum.');
      await new Promise((r) => setTimeout(r, 60));
      const ok = await captureAndShare({
        viewRef: shareCardRef,
        message,
      });
      if (!ok) {
        Alert.alert(
          t('share.failedTitle', 'Paylaşılamadı'),
          t('share.failedBody', 'Bir sorun oluştu, tekrar dene.'),
        );
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />

      <LightTopAppBar
        onAvatarPress={() => navigation.navigate('Settings')}
        onStreakPress={handleShareStreak}
        currentStreak={currentStreak}
        rightContent={
          <TouchableOpacity
            onPress={handleShareStreak}
            disabled={sharing}
            style={styles.shareBtn}
            accessibilityRole="button"
            accessibilityLabel={t('share.streakAria', 'Streak paylaş')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="ios-share"
              size={20}
              color={sharing ? LT.outline : LT.primaryContainer}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — avatar + level ring + rank + name */}
        <View style={styles.hero}>
          <View style={styles.avatarOuter}>
            <CircularProgress size={132} percent={levelPercent} />
            <View style={styles.avatarInner}>
              <MaterialIcons
                name="self-improvement"
                size={48}
                color={LT.primaryContainer}
              />
            </View>
          </View>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>
              {t(`ranks.${rank.id}.title`, rank.title).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.subtitle}>
            {t('profile.subtitle', 'YOLUN BAŞINDA')}
          </Text>
        </View>

        {/* Stats grid 2x2 */}
        <View style={styles.statsGrid}>
          <ProfileStatCard
            icon="bolt"
            label={t('profile.totalXp', 'TOPLAM XP')}
            value={(totalXP ?? 0).toLocaleString(
              i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR',
            )}
          />
          <ProfileStatCard
            icon="local-fire-department"
            iconColor={LT.primaryContainer}
            label={t('profile.currentStreak', 'MEVCUT SERİ')}
            value={`${currentStreak}`}
            unit={t('common.days', 'Gün')}
            accent
          />
          <ProfileStatCard
            icon="menu-book"
            label={t('profile.lessonsDone', 'TAMAMLANAN')}
            value={`${completedLessonsTotal}`}
            unit={t('common.lessons', 'Ders')}
          />
          <ProfileStatCard
            icon="military-tech"
            label={t('profile.longestStreak', 'EN UZUN')}
            value={`${longestStreak || 0}`}
            unit={t('common.days', 'Gün')}
          />
        </View>

        {/* Level progress */}
        <LevelProgressCard
          level={level}
          xpInLevel={xpInLevel}
          xpForNext={xpForNext}
          levelPercent={levelPercent}
          nextRank={nextRank}
        />

        {/* Identity badges — earned by hitting 80%+ on a path */}
        <IdentityBadgesSection
          identityBadges={identityBadges}
          onSharePublicProfile={handleSharePublicProfile}
        />

        {/* Character Hero */}
        <CharacterHero longestStreak={longestStreak} />

        {/* Transformation Report entry-point */}
        {transformationReport ? (
          <TouchableOpacity
            onPress={() => setReportVisible(true)}
            activeOpacity={0.88}
            style={styles.transformCta}
          >
            <View style={styles.transformIcon}>
              <MaterialIcons name="auto-graph" size={22} color="#FDE047" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.transformLabel}>
                {t('transform.entryLabel', 'YOUR TRANSFORMATION')}
              </Text>
              <Text style={styles.transformTitle}>
                {t('transform.entryTitle', 'See how far you have come')}
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        {/* 30-Day Streak Heatmap */}
        <StreakHeatmap lessonHistory={lessonHistory} />

        {/* Path Mastery */}
        <PathMasterySection pathProgress={pathProgress} />

        {/* Achievements */}
        <ProfileAchievementsSection
          recentAchievements={recentAchievements}
          onSelectAchievement={setSelectedAchievement}
        />

        {/* Streak Calendar */}
        <View style={styles.calendarWrap}>
          <StreakCalendar lessonHistory={lessonHistory || {}} />
        </View>

        {/* Reflections link */}
        <View style={styles.linksWrap}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Reflections')}
            activeOpacity={0.85}
            style={styles.linkCard}
          >
            <View style={styles.linkIconBox}>
              <MaterialIcons
                name="auto-stories"
                size={20}
                color={LT.primaryContainer}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>
                {t('profile.reflectionsLink', 'Yansımalarım')}
              </Text>
              <Text style={styles.linkSubtitle}>
                {t(
                  'profile.reflectionsLinkSub',
                  'Geçmiş ders yansımaların',
                )}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={LT.outline}
            />
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <AchievementDetailModal
        visible={!!selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
        achievementId={selectedAchievement?.id}
        unlocked={selectedAchievement && !selectedAchievement.locked}
        onUpgrade={() => navigation.navigate('Paywall', { source: 'achievement_detail' })}
      />

      <TransformationReportModal
        visible={reportVisible}
        report={transformationReport}
        isPremium={isPremium}
        onClose={() => setReportVisible(false)}
        onUpgradeTap={() => {
          setReportVisible(false);
          navigation.navigate('Paywall', { source: 'transformation_report' });
        }}
      />

      {/* Off-screen card used for streak share image capture */}
      <View pointerEvents="none" style={styles.shareCardOffscreen}>
        <StreakShareCard
          ref={shareCardRef}
          streak={currentStreak || 0}
          longestStreak={longestStreak || 0}
          lessonsCompleted={completedLessonsTotal || 0}
          title={t('share.title', 'Ascend: Daily Discipline')}
          subtitle={t('profile.shareSubtitle', 'Disiplin. Odak. Tekrar.')}
          streakLabel={t('profile.shareStreakLabel', 'GÜN')}
          longestLabel={t('profile.shareLongestLabel', 'EN UZUN')}
          lessonsLabel={t('profile.shareLessonsLabel', 'DERS')}
          appLabel="Ascend"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LT.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  shareBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },

  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarOuter: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: LT.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  rankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.25)',
    marginBottom: 8,
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.primaryContainer,
  },
  username: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: LT.onSurface,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: LT.outline,
    marginTop: 4,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
  },

  transformCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: LT_RADIUS.xl,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  transformIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(253, 224, 71, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transformLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#FDE047',
  },
  transformTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },

  calendarWrap: {
    marginBottom: 14,
  },

  linksWrap: {
    paddingHorizontal: LT_SPACING.containerMargin,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  linkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  linkSubtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  shareCardOffscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
});
