// PathScreen — Modern Kartlar (Stitch Vivid Impact light theme).
// Shows the active path's lessons as a vertical card list.
// Active lesson is highlighted with a red border + pulsing animation + CTA.
//
// Backup of the previous (dark M3 Duolingo-style) screen:
//   PathScreen.legacy.js

import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '../contexts/AppContext';
import {
  PATHS,
  getPathLessons,
  getLessonState,
  getPathProgress,
  getPathById,
} from '../data/paths';
import BannerAdBox from '../components/BannerAdBox';
import OutOfHeartsModal from '../components/OutOfHeartsModal';
import StreakInfoModal from '../components/StreakInfoModal';
import LightTopAppBar from '../components/LightTopAppBar';
import PathCertificateCard from '../components/PathCertificateCard';
import { captureAndShare } from '../services/streakShare';
import { useAuth } from '../contexts/AuthContext';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

export default function PathScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    pathProgress,
    activePathId,
    setActivePath,
    isPremium,
    currentStreak,
    hearts,
    heartsRefillAt,
    gainHeart,
  } = useApp();

  const [outOfHeartsVisible, setOutOfHeartsVisible] = useState(false);
  const [streakInfoVisible, setStreakInfoVisible] = useState(false);
  const [sharingCert, setSharingCert] = useState(false);
  const autoStartedRef = useRef(false);
  const certCardRef = useRef(null);
  const { user } = useAuth();

  const activePath = useMemo(
    () => getPathById(activePathId) || PATHS[0],
    [activePathId],
  );
  // Guard: getPathLessons may return undefined if activePath.id is somehow
  // unknown (corrupted state, future-renamed path id, etc.). Default to []
  // so downstream `.map()` and `.length` don't blow up.
  const lessons = useMemo(
    () => getPathLessons(activePath) || [],
    [activePath],
  );
  const progress = useMemo(
    () => getPathProgress(activePath, pathProgress),
    [activePath, pathProgress],
  );

  // Auto-start first lesson on initial mount if user has zero progress.
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (!activePath || lessons.length === 0) return;
    const totalCompleted = Object.values(pathProgress || {}).reduce(
      (s, p) => s + (p?.completed?.length || 0),
      0,
    );
    if (totalCompleted === 0) {
      const timer = setTimeout(() => {
        const firstLesson = lessons[0];
        if (firstLesson) {
          navigation.navigate('Lesson', {
            pathId: firstLesson.pathId,
            lessonId: firstLesson.id,
          });
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [activePath, lessons, pathProgress, navigation]);

  const handleLessonTap = (lesson, finalState) => {
    if (finalState === 'premium') {
      navigation.navigate('Paywall');
      return;
    }
    if (finalState === 'locked') {
      // tapping locked is a no-op (we don't reveal hint via toast for now)
      return;
    }
    if (!isPremium && hearts <= 0) {
      setOutOfHeartsVisible(true);
      return;
    }
    navigation.navigate('Lesson', {
      pathId: lesson.pathId,
      lessonId: lesson.id,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />

      <LightTopAppBar
        onAvatarPress={() => navigation.navigate('Settings')}
        onStreakPress={() => setStreakInfoVisible(true)}
        currentStreak={currentStreak}
        rightContent={
          <TouchableOpacity
            onPress={() => navigation.navigate('LessonSearch')}
            style={styles.searchBtn}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          >
            <MaterialIcons name="search" size={20} color={LT.onSurface} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>
            {t(
              `paths.${activePath.id}.title`,
              t('path.developmentStages', 'Gelişim Aşamaları'),
            )}
          </Text>
          <Text style={styles.pageSubtitle}>
            {t(
              `paths.${activePath.id}.subtitle`,
              t(
                'path.devSubtitle',
                'Zihinsel ve ruhsal ustalığa giden yol haritanız.',
              ),
            )}
          </Text>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              {progress.completed} / {progress.total}{' '}
              {t('path.lessonsLabel', 'ders')}
            </Text>
            <View style={styles.progressMetaDot} />
            <Text style={styles.progressMetaText}>{progress.percent}%</Text>
          </View>

          {progress.percent === 100 ? (
            <TouchableOpacity
              onPress={async () => {
                if (sharingCert) return;
                setSharingCert(true);
                const today = new Date();
                // Force en-US so non-Latin locales (AR, FA, HI) don't
                // emit non-Latin digits that break downstream rendering
                // or look out of place on a English-styled certificate.
                const dateStr = today.toLocaleDateString('en-US');
                const userName =
                  (user?.user_metadata?.name || '').trim() ||
                  (user?.email || '').split('@')[0] ||
                  t('home.greetingName', 'Disiplinci');
                // Wait one tick so the off-screen card has its latest props
                // before captureRef reads pixels.
                await new Promise((r) => setTimeout(r, 50));
                try {
                  await captureAndShare({
                    viewRef: certCardRef,
                    message: t(
                      'path.certShareMessage',
                      '{{path}} yolunu tamamladım — {{count}} ders bitti. Disiplin akademisi: ascend.app',
                      { path: t(`paths.${activePath.id}.title`, activePath.id), count: progress.completed },
                    ),
                  });
                } finally {
                  setSharingCert(false);
                }
              }}
              activeOpacity={0.85}
              style={styles.certCta}
            >
              <MaterialIcons name="verified" size={18} color={LT.onPrimary} />
              <Text style={styles.certCtaText}>
                {sharingCert
                  ? t('path.certPreparing', 'Sertifika hazırlanıyor...')
                  : t('path.certCta', 'Sertifikamı paylaş')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Path Switcher Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pathSwitcher}
        >
          {PATHS.map((p) => {
            const isActive = p.id === activePathId;
            const pathProg =
              pathProgress?.[p.id]?.completed?.length || 0;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setActivePath(p.id)}
                style={[styles.pathPill, isActive && styles.pathPillActive]}
                activeOpacity={0.85}
              >
                <MaterialIcons
                  name={p.materialIcon}
                  size={16}
                  color={isActive ? LT.onPrimary : LT.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.pathPillText,
                    isActive && styles.pathPillTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t(`paths.${p.id}.shortTitle`, p.id)}
                </Text>
                {pathProg > 0 && (
                  <Text
                    style={[
                      styles.pathPillBadge,
                      isActive && styles.pathPillBadgeActive,
                    ]}
                  >
                    {pathProg}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lesson Cards */}
        <View style={styles.cardsContainer}>
          {lessons.map((lesson) => {
            const state = getLessonState(lesson, pathProgress);
            const isLockedByPremium =
              !isPremium && lesson.order > (activePath.freeLessons || 5);
            const finalState =
              isLockedByPremium && state !== 'completed' ? 'premium' : state;
            return (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                state={finalState}
                pathColor={activePath.color}
                onPress={() => handleLessonTap(lesson, finalState)}
              />
            );
          })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <BannerAdBox />

      <OutOfHeartsModal
        visible={outOfHeartsVisible}
        onClose={() => setOutOfHeartsVisible(false)}
        onRefill={() => {
          // +1 kalp, full refill değil — CTA "+1 KALP KAZAN" ile uyumlu.
          gainHeart();
          setOutOfHeartsVisible(false);
        }}
        // Without this, the "PREMIUM İLE SINIRSIZ KALPLER" button
        // inside the modal silently no-ops (onPaywall?.() with no
        // handler attached). Free user with 0 hearts on Paths tab
        // would tap the red CTA and see nothing happen.
        onPaywall={() => {
          setOutOfHeartsVisible(false);
          navigation.navigate('Paywall');
        }}
        refillAt={heartsRefillAt}
      />

      <StreakInfoModal
        visible={streakInfoVisible}
        onClose={() => setStreakInfoVisible(false)}
        currentStreak={currentStreak}
      />

      {/* Off-screen certificate captured for share image */}
      <View pointerEvents="none" style={styles.certOffscreen}>
        <PathCertificateCard
          ref={certCardRef}
          pathTitle={t(`paths.${activePath.id}.title`, activePath.id)}
          completedDate={new Date().toLocaleDateString('en-US')}
          userName={
            (user?.user_metadata?.name || '').trim() ||
            (user?.email || '').split('@')[0] ||
            t('home.greetingName', 'Disiplinci')
          }
          lessonsCount={progress.completed}
          daysCount={currentStreak}
          title={t('path.certTitle', 'Disiplin Sertifikası')}
          subtitle={t('path.certSubtitle', 'Yolu tamamladı')}
          lessonsLabel={t('path.certLessons', 'DERS').toUpperCase()}
          daysLabel={t('path.certDays', 'GÜN').toUpperCase()}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── LessonCard ───────────────────────────────────────────────────────────────

function LessonCard({ lesson, state, onPress }) {
  const { t } = useTranslation();
  const isActive = state === 'current';
  const isCompleted = state === 'completed';
  const isLocked = state === 'locked';
  const isPremium = state === 'premium';

  // Pulse animation only for active card
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isActive) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, pulseAnim]);

  const orderText = String(lesson.order).padStart(2, '0');
  const i18nKeyTitle = `lessons.${lesson.pathId}.${lesson.order}.title`;
  const i18nKeySummary = `lessons.${lesson.pathId}.${lesson.order}.summary`;
  const fallbackTitle = `${t('path.lessonLabel', 'Ders')} ${lesson.order}`;
  const fallbackSummary = t(
    'path.lessonGenericSummary',
    'Disiplin yolunda bir adım daha. Tap to start.',
  );

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        isActive && { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={isLocked ? 1 : 0.85}
        onPress={onPress}
        style={[
          styles.card,
          isActive && styles.cardActive,
          isCompleted && styles.cardCompleted,
          (isLocked || isPremium) && styles.cardLocked,
        ]}
      >
        {/* Background big number (decorative) */}
        <Text
          style={[
            styles.cardBgNumber,
            isActive && styles.cardBgNumberActive,
            (isLocked || isPremium) && styles.cardBgNumberLocked,
          ]}
          pointerEvents="none"
          numberOfLines={1}
        >
          {orderText}
        </Text>

        <View style={styles.cardRow}>
          <View style={styles.cardTextWrap}>
            {isActive && (
              <Text style={styles.cardActiveLabel}>
                {t('path.activeStage', 'AKTİF DERS')}
              </Text>
            )}
            <Text
              style={[
                styles.cardTitle,
                (isLocked || isPremium) && styles.cardTitleMuted,
              ]}
              numberOfLines={2}
            >
              {t(i18nKeyTitle, fallbackTitle)}
            </Text>
            <Text
              style={[
                styles.cardDescription,
                (isLocked || isPremium) && styles.cardDescriptionMuted,
              ]}
              numberOfLines={3}
            >
              {t(i18nKeySummary, fallbackSummary)}
            </Text>
          </View>

          {/* Right-side icon */}
          <View style={styles.cardIconWrap}>
            {isActive && (
              <View style={styles.iconActive}>
                <MaterialIcons
                  name="play-arrow"
                  size={24}
                  color={LT.onPrimary}
                />
              </View>
            )}
            {isCompleted && (
              <View style={styles.iconCompleted}>
                <MaterialIcons
                  name="check"
                  size={20}
                  color={LT.primaryContainer}
                />
              </View>
            )}
            {(isLocked || isPremium) && (
              <View style={styles.iconLocked}>
                <MaterialIcons
                  name={isPremium ? 'workspace-premium' : 'lock'}
                  size={18}
                  color={LT.onSurfaceVariant}
                />
              </View>
            )}
          </View>
        </View>

        {/* Active card: progress bar showing user's position in this path */}
        {isActive && (
          <View style={styles.progressBarWrap}>
            <View style={styles.progressBarLabels}>
              <Text style={styles.progressBarLabel}>
                {t('path.lessonProgress', 'İLERLEME')}
              </Text>
              <Text style={styles.progressBarValue}>
                {Math.round(((lesson.order - 1) / 50) * 100)}%
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${((lesson.order - 1) / 50) * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Premium hint pill */}
        {isPremium && (
          <View style={styles.premiumHintPill}>
            <MaterialIcons
              name="workspace-premium"
              size={12}
              color={LT.primaryContainer}
            />
            <Text style={styles.premiumHintText}>
              {t('path.premiumToUnlock', 'PREMIUM İLE AÇ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
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

  // Page header
  pageHeader: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 28,
    paddingBottom: 18,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 38,
    color: LT.onSurface,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: LT.onSurfaceVariant,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  progressMetaText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: LT.outline,
  },
  progressMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LT.outlineVariant,
  },

  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },

  certCta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignSelf: 'flex-start',
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  certCtaText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  certOffscreen: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 720,
    height: 480,
  },

  // Path switcher pills
  pathSwitcher: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingVertical: 8,
    gap: 8,
  },
  pathPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  pathPillActive: {
    backgroundColor: LT.primaryContainer,
    borderColor: LT.primaryContainer,
  },
  pathPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: LT.onSurfaceVariant,
  },
  pathPillTextActive: {
    color: LT.onPrimary,
  },
  pathPillBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: LT.outline,
    backgroundColor: LT.surfaceContainerLowest,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: LT_RADIUS.pill,
    overflow: 'hidden',
    minWidth: 20,
    textAlign: 'center',
  },
  pathPillBadgeActive: {
    color: LT.primaryContainer,
    backgroundColor: '#FFFFFF',
  },

  // Cards container
  cardsContainer: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 8,
    gap: 12,
  },

  cardOuter: {
    // wrapper so transform pulse doesn't clip
  },

  // Card base
  card: {
    position: 'relative',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
    minHeight: 130,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: LT.primaryContainer,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  cardCompleted: {
    backgroundColor: LT.surfaceContainerLowest,
    opacity: 0.92,
  },
  cardLocked: {
    backgroundColor: LT.surfaceContainerLow,
    borderColor: 'rgba(232, 188, 182, 0.5)',
  },

  cardBgNumber: {
    position: 'absolute',
    right: -8,
    bottom: -36,
    fontSize: 140,
    fontWeight: '900',
    lineHeight: 140,
    color: LT.onSurface,
    opacity: 0.045,
    letterSpacing: -4,
  },
  cardBgNumberActive: {
    color: LT.primaryContainer,
    opacity: 0.07,
  },
  cardBgNumberLocked: {
    color: LT.outline,
    opacity: 0.05,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 1,
  },
  cardTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  cardActiveLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: LT.primaryContainer,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.4,
    color: LT.onSurface,
    marginBottom: 6,
  },
  cardTitleMuted: {
    color: LT.onSurfaceVariant,
  },
  cardDescription: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: LT.onSurfaceVariant,
  },
  cardDescriptionMuted: {
    color: LT.outline,
  },

  cardIconWrap: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  iconActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LT.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 4,
  },
  iconCompleted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLocked: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LT.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Active card progress bar
  progressBarWrap: {
    marginTop: 18,
    zIndex: 1,
  },
  progressBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressBarLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
  },
  progressBarValue: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: LT.primaryContainer,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: LT.surfaceContainerHigh,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: LT.primaryContainer,
    borderRadius: 4,
  },

  // Premium hint pill at bottom of locked card
  premiumHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.2)',
    zIndex: 1,
  },
  premiumHintText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.primaryContainer,
  },
});
