// ProfileScreen — "Sen" tab in the redesigned 4-tab nav.
// Vivid Impact light theme. Avatar + level progress, rank badge,
// stats grid, achievements horizontal scroll, streak heatmap, share + reflections.
//
// Backup: ProfileScreen.legacy.js

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  StatusBar,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { LEVEL_THRESHOLDS, getNextLevel } from '../config/constants';
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
import { LT_SPACING, LT_RADIUS } from '../config/lightTheme';
import { useTheme, useThemedStyles } from '../config/theme';

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const appState = useApp();
  // Dark-mode-aware theme + styles. See `src/config/theme.js`.
  const T = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {
    totalXP,
    level,
    currentStreak,
    longestStreak,
    pathProgress,
    unlockedAchievements,
    lessonHistory,
    anonUsername,
    isPremium,
  } = appState;
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const shareCardRef = useRef(null);

  // Compute transformation report on demand. reportEligible gates the
  // entry-point card (≥10 lessons + ≥7 days since install); below that
  // the data is too thin to be encouraging.
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

  const completedPaths = useMemo(() => {
    return Object.values(pathProgress || {}).filter(
      (p) => (p?.completed?.length || 0) >= 30,
    ).length;
  }, [pathProgress]);

  const rank = useMemo(() => getRank(completedPaths), [completedPaths]);
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
    [pathProgress],
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

  const username = user?.email?.split('@')[0] || 'StoicMonk';

  const handleSharePublicProfile = async () => {
    const handle = anonUsername || 'monk';
    const link = `https://ascend.app/u/${encodeURIComponent(handle)}`;
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
          ? t('share.streakActive', '{{streak}} gün — monk mode sürüyor 🔥', {
              streak: currentStreak,
            })
          : t('share.streakStart', 'Monk mode başlatıyorum 🔥');
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
      <StatusBar barStyle="dark-content" backgroundColor={T.background} />

      <LightTopAppBar
        onAvatarPress={() => navigation.navigate('Settings')}
        onStreakPress={handleShareStreak}
        currentStreak={currentStreak}
        rightContent={
          <TouchableOpacity
            onPress={handleShareStreak}
            disabled={sharing}
            style={styles.shareBtn}
            accessibilityLabel={t('share.streakAria', 'Streak paylaş')}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="ios-share"
              size={20}
              color={sharing ? T.outline : T.primaryContainer}
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
                color={T.primaryContainer}
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
          <StatCard
            icon="bolt"
            label={t('profile.totalXp', 'TOPLAM XP')}
            value={totalXP.toLocaleString()}
          />
          <StatCard
            icon="local-fire-department"
            iconColor={T.primaryContainer}
            label={t('profile.currentStreak', 'MEVCUT SERİ')}
            value={`${currentStreak}`}
            unit={t('common.days', 'Gün')}
            accent
          />
          <StatCard
            icon="menu-book"
            label={t('profile.lessonsDone', 'TAMAMLANAN')}
            value={`${completedLessonsTotal}`}
            unit={t('common.lessons', 'Ders')}
          />
          <StatCard
            icon="military-tech"
            label={t('profile.longestStreak', 'EN UZUN')}
            value={`${longestStreak || 0}`}
            unit={t('common.days', 'Gün')}
          />
        </View>

        {/* Level progress */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View>
              <Text style={styles.levelLabel}>
                {t('profile.level', 'SEVİYE')} {level}
              </Text>
              <Text style={styles.levelTitle}>
                {t(
                  `level.${level}`,
                  LEVEL_THRESHOLDS.find((tier) => tier.level === level)
                    ?.title || 'Beginner',
                )}
              </Text>
            </View>
            <Text style={styles.levelXP}>
              <Text style={styles.levelXPNum}>{xpInLevel}</Text>
              <Text style={styles.levelXPMax}> / {xpForNext} XP</Text>
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${levelPercent}%` }]}
            />
          </View>
          {nextRank ? (
            <View style={styles.nextRankPill}>
              <MaterialIcons
                name="trending-up"
                size={12}
                color={T.primaryContainer}
              />
              <Text style={styles.nextRankText}>
                {t('profile.nextRank', 'SONRAKİ RÜTBE')}:{' '}
                <Text style={styles.nextRankValue}>
                  {t(`ranks.${nextRank.id}.title`, nextRank.title)}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Identity badges — earned by hitting 80%+ on a path */}
        {identityBadges.length > 0 ? (
          <View style={styles.badgesSection}>
            <View style={styles.badgesHeader}>
              <Text style={styles.sectionTitle}>
                {t('profile.identityTitle', 'KİMLİĞİN')}
              </Text>
              <TouchableOpacity
                onPress={handleSharePublicProfile}
                activeOpacity={0.7}
                style={styles.publicShareBtn}
              >
                <MaterialIcons name="ios-share" size={14} color={T.primary} />
                <Text style={styles.publicShareText}>
                  {t('profile.publicShareCta', 'PROFİLİ PAYLAŞ')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.badgesIntro}>
              {t(
                'profile.identitySub',
                'Bitirdiğin yollar seni şekillendiriyor. Sen artık şusun:',
              )}
            </Text>
            <View style={styles.badgesRow}>
              {identityBadges.map((b) => (
                <View key={b.id} style={styles.badgeChip}>
                  <Text style={styles.badgeIcon}>{b.icon}</Text>
                  <Text style={styles.badgeTitle}>{b.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Character Hero — large visual identity badge keyed off the
            user's longest streak. This is the "look who I am now" piece
            that turns the streak into a SELF, not just a number. Pinned
            high in the profile so it's the first thing seen. */}
        <CharacterHero longestStreak={longestStreak} />

        {/* Transformation Report entry-point — only renders once user
            has enough data (≥10 lessons + ≥7 days). The big "look
            how far you've come" surface. Knockout retention feature
            for v1.0.12. */}
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

        {/* 30-Day Streak Heatmap — GitHub-style activity grid. Visual
            proof of investment, drives sunk-cost retention. Reads
            from lessonHistory which the reducer maintains on every
            lesson completion. */}
        <StreakHeatmap lessonHistory={lessonHistory} />

        {/* Path Mastery — per-path progress percentage cards. Creates
            sunk-cost feeling: "I've invested X% on this path, can't quit
            now". Big retention lever for habit apps. */}
        <View style={styles.pathMasterySection}>
          <Text style={styles.sectionTitle}>
            {t('profile.pathMasteryTitle', 'YOL USTALIĞI')}
          </Text>
          {PATHS.map((p) => {
            const completed = pathProgress?.[p.id]?.completed?.length || 0;
            const total = p.duration || 50;
            const pct = Math.min(100, Math.round((completed / total) * 100));
            return (
              <View key={p.id} style={styles.masteryRow}>
                <View style={styles.masteryHeader}>
                  <MaterialIcons
                    name={p.materialIcon}
                    size={16}
                    color={T.onSurfaceVariant}
                  />
                  <Text style={styles.masteryName} numberOfLines={1}>
                    {t(`paths.${p.id}.shortTitle`, p.title)}
                  </Text>
                  <Text style={styles.masteryPct}>{pct}%</Text>
                </View>
                <View style={styles.masteryTrack}>
                  <View
                    style={[
                      styles.masteryFill,
                      { width: `${pct}%` },
                      pct >= 100 ? styles.masteryFillDone : null,
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Achievements */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('profile.achievements', 'BAŞARIMLAR')}
            </Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.seeAll}>
              <Text style={styles.seeAllText}>
                {t('profile.seeAll', 'TÜMÜ')}
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={16}
                color={T.primaryContainer}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsRow}
          >
            {recentAchievements.map((a, i) => (
              <AchievementCard
                key={i}
                id={a.id}
                locked={a.locked}
                onPress={() => setSelectedAchievement(a)}
              />
            ))}
          </ScrollView>
        </View>

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
                color={T.primaryContainer}
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
              color={T.outline}
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
        onUpgrade={() => navigation.navigate('Paywall')}
      />

      {/* Transformation Report — full-screen modal with personal
          insights from on-device data. Free users see 4 headline
          stats + a premium teaser; premium users see full insights
          and can share. */}
      <TransformationReportModal
        visible={reportVisible}
        report={transformationReport}
        isPremium={isPremium}
        onClose={() => setReportVisible(false)}
        onUpgradeTap={() => {
          setReportVisible(false);
          navigation.navigate('Paywall');
        }}
      />

      {/* Off-screen card used for streak share image capture */}
      <View pointerEvents="none" style={styles.shareCardOffscreen}>
        <StreakShareCard
          ref={shareCardRef}
          streak={currentStreak || 0}
          longestStreak={longestStreak || 0}
          lessonsCompleted={completedLessonsTotal || 0}
          title={t('share.title', 'Monk Mode 🔥')}
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

// ─── Subcomponents ────────────────────────────────────────────────────────────

function CircularProgress({ size = 132, percent = 0 }) {
  const T = useTheme();
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <Svg
      width={size}
      height={size}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={T.outlineVariant}
        strokeWidth={stroke}
        fill="transparent"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={T.primaryContainer}
        strokeWidth={stroke}
        fill="transparent"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

function StatCard({ icon, iconColor, label, value, unit, accent }) {
  const T = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <View style={styles.statCardHeader}>
        <MaterialIcons
          name={icon}
          size={16}
          color={iconColor || T.onSurfaceVariant}
        />
        <Text style={styles.statCardLabel}>{label}</Text>
      </View>
      <View style={styles.statCardBody}>
        <Text style={[styles.statCardValue, accent && styles.statCardValueAccent]}>
          {value}
        </Text>
        {unit ? <Text style={styles.statCardUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const ACHIEVEMENT_ICONS = {
  streak3: 'local-fire-department',
  streak7: 'local-fire-department',
  streak14: 'local-fire-department',
  streak30: 'workspace-premium',
  streak100: 'military-tech',
  lessons10: 'menu-book',
  lessons50: 'menu-book',
  lessons100: 'star',
  pathComplete: 'check-circle',
  perfectQuiz: 'verified',
};

function AchievementCard({ id, locked, onPress }) {
  const { t } = useTranslation();
  const T = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) return null;
  const iconName = ACHIEVEMENT_ICONS[id] || 'emoji-events';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.achCard, locked && styles.achCardLocked]}
    >
      <View
        style={[
          styles.achIconBox,
          locked && styles.achIconBoxLocked,
        ]}
      >
        <MaterialIcons
          name={locked ? 'lock' : iconName}
          size={28}
          color={locked ? T.outline : T.primaryContainer}
        />
      </View>
      <Text
        style={[styles.achTitle, locked && styles.achTitleLocked]}
        numberOfLines={2}
      >
        {t(`ach.${id}.title`, ach.title || id)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Theme-aware stylesheet factory. See `src/config/theme.js`.
const makeStyles = (T) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: T.background,
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
  },

  // Off-screen share card
  shareCardOffscreen: {
    position: 'absolute',
    top: 10000,
    left: 0,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: LT_SPACING.containerMargin,
  },
  avatarOuter: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInner: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: T.surfaceContainerLow,
    borderWidth: 2,
    borderColor: T.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    backgroundColor: T.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: LT_RADIUS.pill,
    marginBottom: 12,
    shadowColor: T.primaryContainer,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  rankBadgeText: {
    color: T.onPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  username: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: T.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: T.onSurfaceVariant,
  },

  // Stats grid (2x2)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: LT_SPACING.containerMargin,
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: '48%',
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: T.outlineVariant,
    padding: 14,
    minHeight: 104,
  },
  statCardAccent: {
    borderColor: 'rgba(227, 18, 18, 0.4)',
    backgroundColor: 'rgba(227, 18, 18, 0.04)',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: T.onSurfaceVariant,
  },
  statCardBody: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statCardValue: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    color: T.onSurface,
  },
  statCardValueAccent: {
    color: T.primaryContainer,
  },
  statCardUnit: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: T.outline,
    textTransform: 'uppercase',
  },

  // Level progress
  levelCard: {
    marginHorizontal: LT_SPACING.containerMargin,
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: T.outlineVariant,
    padding: 18,
    marginBottom: 14,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  levelLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: T.onSurfaceVariant,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: T.onSurface,
    marginTop: 2,
  },
  levelXP: {
    textAlign: 'right',
  },
  levelXPNum: {
    fontSize: 18,
    fontWeight: '900',
    color: T.primaryContainer,
    letterSpacing: -0.4,
  },
  levelXPMax: {
    fontSize: 12,
    fontWeight: '700',
    color: T.outline,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: T.surfaceContainer,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.primaryContainer,
    borderRadius: 4,
  },
  nextRankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: 'rgba(227, 18, 18, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
  },
  nextRankText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: T.onSurfaceVariant,
  },
  nextRankValue: {
    color: T.primaryContainer,
    fontWeight: '900',
  },

  // Achievements
  badgesSection: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 16,
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: T.outlineVariant,
    padding: 16,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publicShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  publicShareText: {
    color: T.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  badgesIntro: {
    fontSize: 12,
    color: T.onSurfaceVariant,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: T.surfaceContainer,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.22)',
  },
  badgeIcon: { fontSize: 16 },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: T.onSurface,
    letterSpacing: -0.2,
  },

  // Transformation Report entry CTA — dark gradient card on Profile
  // that opens the full TransformationReportModal. Only renders once
  // the user has enough data (gated by reportEligible).
  transformCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  transformIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(253, 224, 71, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transformLabel: {
    color: '#FDE047',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  transformTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  // Path Mastery — per-path progress cards. The sunk-cost visualization
  // ("I've completed 38% of Mind Discipline, I can't quit now") that
  // makes habit-loop apps stick.
  pathMasterySection: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 18,
    padding: 16,
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.outlineVariant,
  },
  masteryRow: {
    marginTop: 12,
  },
  masteryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  masteryName: {
    flex: 1,
    color: T.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },
  masteryPct: {
    color: T.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'right',
  },
  masteryTrack: {
    height: 6,
    backgroundColor: T.outlineVariant,
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    backgroundColor: T.primary,
    borderRadius: 3,
  },
  masteryFillDone: {
    backgroundColor: T.success || '#10B981',
  },
  achievementsSection: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LT_SPACING.containerMargin,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: T.onSurface,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: T.primaryContainer,
  },
  achievementsRow: {
    paddingHorizontal: LT_SPACING.containerMargin,
    gap: 10,
  },
  achCard: {
    width: 110,
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: T.outlineVariant,
    padding: 12,
    alignItems: 'center',
    minHeight: 110,
  },
  achCardLocked: {
    backgroundColor: T.surfaceContainerLow,
    opacity: 0.7,
  },
  achIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achIconBoxLocked: {
    backgroundColor: T.surfaceContainer,
    borderColor: T.outlineVariant,
  },
  achTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: T.onSurface,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  achTitleLocked: {
    color: T.outline,
  },

  // Calendar
  calendarWrap: {
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: T.outlineVariant,
    padding: 18,
  },

  // Links
  linksWrap: {
    paddingHorizontal: LT_SPACING.containerMargin,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: T.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: T.outlineVariant,
    padding: 16,
  },
  linkIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: T.onSurface,
    marginBottom: 2,
  },
  linkSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: T.onSurfaceVariant,
  },
});
