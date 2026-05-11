// "Next up" lesson card on the Home screen — surfaces the user's NEXT
// uncompleted lesson across all paths so they can one-tap into it.
//
// Why this exists:
//   - Decision fatigue is the #1 reason habit-app users drop off ("which
//     path? which lesson? do I have time?"). One clear next action
//     removes the decision.
//   - Duolingo's "next lesson" tile drives ~40% of all sessions.
//   - The card switches between "Continue active path" (most common)
//     and "Pick a path" (no active path or all done) so it's never empty.
//
// Cycles through:
//   1. Active path has uncompleted lessons → show next lesson in active.
//   2. Active path complete but other paths exist → suggest next path.
//   3. All paths complete → "🎉 You finished everything" card.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import {
  PATHS,
  getPathById,
  getCurrentLesson,
  isPathComplete,
} from '../data/paths';
import { hapticImpactMedium } from '../services/haptics';

export default function LessonQueueCard({
  activePathId,
  pathProgress,
  onPressLesson,
  onPressPath,
}) {
  const { t } = useTranslation();

  // Pick the lesson to surface. Priority order described in file header.
  const target = useMemo(() => {
    const activePath = getPathById(activePathId);
    if (activePath && !isPathComplete(activePath, pathProgress)) {
      const lesson = getCurrentLesson(activePath, pathProgress);
      if (lesson) return { kind: 'lesson', path: activePath, lesson };
    }
    // Active path done — find next non-complete path.
    const fallbackPath = PATHS.find((p) => !isPathComplete(p, pathProgress));
    if (fallbackPath) {
      const lesson = getCurrentLesson(fallbackPath, pathProgress);
      if (lesson) return { kind: 'newPath', path: fallbackPath, lesson };
    }
    // Everything done.
    return { kind: 'allDone' };
  }, [activePathId, pathProgress]);

  if (target.kind === 'allDone') {
    return (
      <View style={[styles.card, styles.cardDone]}>
        <Text style={styles.doneEmoji}>🏆</Text>
        <Text style={styles.doneTitle}>{t('home.allDone')}</Text>
        <Text style={styles.doneSub}>{t('home.allDoneSub')}</Text>
      </View>
    );
  }

  const { path, lesson, kind } = target;
  const completed = pathProgress?.[path.id]?.completed?.length || 0;
  const progressPct = Math.min(100, (completed / path.duration) * 100);

  const handlePress = () => {
    hapticImpactMedium();
    onPressLesson?.(path.id, lesson.id);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialIcons
            name={path.materialIcon}
            size={20}
            color={LT.onPrimary}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            {kind === 'newPath'
              ? t('home.viewPaths')
              : t('home.todayCta')}
          </Text>
          <Text style={styles.pathName} numberOfLines={1}>
            {t(`paths.${path.id}.title`, path.title)}
          </Text>
        </View>
        <MaterialIcons
          name="arrow-forward"
          size={22}
          color={LT.onSurfaceVariant}
        />
      </View>

      <Text style={styles.lessonTitle} numberOfLines={2}>
        {/* Lesson keys in lessons.{tr,en}.json are nested:
            lessons.<pathId>.<order>.title — not flat
            lessons.<pathId>-<order>.title. Previous code passed the
            flat lesson.id which never resolved, so users saw the
            generic fallback instead of the real lesson title. */}
        {t(`lessons.${lesson.pathId}.${lesson.order}.title`, lesson.title)}
      </Text>

      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {completed} / {path.duration}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: LT.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  eyebrow: {
    color: LT.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  pathName: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  lessonTitle: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: LT.outlineVariant,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: LT.primary,
    borderRadius: 3,
  },
  progressText: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  cardDone: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  doneEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  doneTitle: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  doneSub: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
