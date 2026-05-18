// Adaptive Coach Card — surfaced on Home when the user's rolling quiz
// accuracy crosses a threshold. Two states:
//
//   - 'mastery'  : "Crushing it — try [harder path]" with switch-path CTA.
//   - 'struggle' : "Take it slow — review the basics" with calmer copy.
//
// We never reorder lessons inside a path (would break the chapter
// narrative). Instead, this card whispers: when the user is mastering,
// it points them at a new mountain; when they're stuck, it reminds them
// it's OK to slow down and re-read.
//
// Card is fully dismissible (per-session via component state). Caller
// should pass a stable `onSwitchPath` that updates activePathId.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { hapticImpactLight } from '../services/haptics';

export default function AdaptiveCoachCard({
  suggestion,    // { kind: 'mastery' | 'struggle', accuracy, suggestPathId? }
  onSwitchPath,  // (pathId) => void
  onOpenPaths,   // () => void
  onDismiss,     // () => void
}) {
  const { t } = useTranslation();
  if (!suggestion) return null;

  const accuracyPct = Math.round((suggestion.accuracy || 0) * 100);
  const isMastery = suggestion.kind === 'mastery';

  const eyebrow = isMastery
    ? t('adaptiveCoach.masteryEyebrow', 'ADAPTIVE COACH · YOU ARE MASTERING')
    : t('adaptiveCoach.struggleEyebrow', 'ADAPTIVE COACH · TAKE IT SLOW');

  const title = isMastery
    ? t(
        'adaptiveCoach.masteryTitle',
        '{{accuracy}}% accuracy — ready for harder work',
        { accuracy: accuracyPct },
      )
    : t(
        'adaptiveCoach.struggleTitle',
        'No shame in re-reading',
      );

  const subtitle = isMastery
    ? t(
        'adaptiveCoach.masterySub',
        'You are flying through the quizzes. Try a fresh path to keep the edge.',
      )
    : t(
        'adaptiveCoach.struggleSub',
        'Quiz scores are low — slow the pace. Re-read recent lessons before the next one.',
      );

  const handleCta = () => {
    hapticImpactLight();
    if (isMastery && suggestion.suggestPathId && onSwitchPath) {
      onSwitchPath(suggestion.suggestPathId);
    } else if (onOpenPaths) {
      onOpenPaths();
    }
  };

  return (
    <View
      style={[
        styles.card,
        isMastery ? styles.cardMastery : styles.cardStruggle,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <MaterialIcons
            name={isMastery ? 'trending-up' : 'self-improvement'}
            size={18}
            color={isMastery ? LT.success : LT.tertiary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.eyebrow,
              { color: isMastery ? LT.success : LT.tertiary },
            ]}
          >
            {eyebrow}
          </Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {onDismiss ? (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.dismissBtn}
          >
            <MaterialIcons name="close" size={14} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.sub}>{subtitle}</Text>
      <TouchableOpacity
        onPress={handleCta}
        activeOpacity={0.85}
        style={[
          styles.cta,
          {
            backgroundColor: isMastery ? LT.success : LT.tertiary,
          },
        ]}
      >
        <Text style={styles.ctaText}>
          {isMastery
            ? t('adaptiveCoach.masteryCta', 'EXPLORE NEW PATH')
            : t('adaptiveCoach.struggleCta', 'BROWSE LESSONS TO REVIEW')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardMastery: {
    borderColor: LT.success,
    backgroundColor: '#F2FBF6',
  },
  cardStruggle: {
    borderColor: LT.tertiary,
    backgroundColor: '#F4F5FF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  sub: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 12,
  },
  dismissBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: LT.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
