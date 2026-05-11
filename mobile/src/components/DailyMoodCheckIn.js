// Daily mood check-in — once-per-day prompt that asks "how do you
// feel today?" and uses the answer to refresh the personalization
// signals that the daily challenge picker reads.
//
// Why: the onboarding mood answer is a snapshot. A user who said
// "motivated" 30 days ago might be exhausted today — without refreshing
// the signal, we'd keep recommending hardcore challenges they can't
// stick to. Captured fresh each day, then the daily challenge picker
// adapts immediately.
//
// UX: 3-button row with emoji + label. Tap once, the card collapses
// into a "Today's mood: X · tap to change" pill (still tappable in
// case they want to update — life happens). Dismissable.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { hapticImpactLight } from '../services/haptics';

const MOODS = [
  { id: 'motivated', emoji: '🔥', tone: 'high' },
  { id: 'fresh', emoji: '☀️', tone: 'mid' },
  { id: 'lost', emoji: '😶‍🌫️', tone: 'low' },
];

export default function DailyMoodCheckIn({
  todayMood, // null if not yet picked today; mood id otherwise
  onPick,
  onDismiss,
}) {
  const { t } = useTranslation();
  // Local expand toggle: when user already picked, the card is pill-
  // sized; tapping it re-opens the full picker.
  const [expanded, setExpanded] = useState(!todayMood);

  const handlePick = (id) => {
    hapticImpactLight();
    onPick?.(id);
    setExpanded(false);
  };

  // Collapsed (pill) state — user already picked today. Defensive
  // guard: if state somehow contains an unknown mood id (corruption,
  // schema migration), fall back to the picker rather than rendering
  // a broken pill with the i18n key as text.
  if (todayMood && !expanded) {
    const picked = MOODS.find((m) => m.id === todayMood);
    if (!picked) {
      // Unknown mood id — render the picker so the user can re-pick.
      // (Falls through to the expanded JSX below.)
    } else {
      const labelKey = `onboarding.mood${picked.id.charAt(0).toUpperCase()}${picked.id.slice(1)}`;
      return (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          activeOpacity={0.8}
          style={styles.pill}
        >
          <Text style={styles.pillEmoji}>{picked.emoji}</Text>
          <Text style={styles.pillText}>
            {t('moodCheckIn.todayPill', "TODAY'S MOOD")} · {t(labelKey)}
          </Text>
          <MaterialIcons name="edit" size={14} color={LT.onSurfaceVariant} />
        </TouchableOpacity>
      );
    }
  }

  // Expanded (picker) state.
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('moodCheckIn.label', 'MOOD CHECK')}</Text>
          <Text style={styles.title}>
            {t('moodCheckIn.title', 'How are you feeling today?')}
          </Text>
        </View>
        {onDismiss ? (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={16} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.row}>
        {MOODS.map((m) => (
          <TouchableOpacity
            key={m.id}
            onPress={() => handlePick(m.id)}
            activeOpacity={0.85}
            style={[
              styles.moodBtn,
              todayMood === m.id ? styles.moodBtnActive : null,
            ]}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text
              style={[
                styles.moodLabel,
                todayMood === m.id ? styles.moodLabelActive : null,
              ]}
              numberOfLines={1}
            >
              {t(`onboarding.mood${m.id.charAt(0).toUpperCase()}${m.id.slice(1)}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eyebrow: {
    color: LT.primary,
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
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LT.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moodBtnActive: {
    borderColor: LT.primary,
    backgroundColor: LT.primaryContainer,
  },
  moodEmoji: { fontSize: 26, marginBottom: 4 },
  moodLabel: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
  },
  moodLabelActive: { color: LT.onPrimary },

  // Pill state — user already picked today
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  pillEmoji: { fontSize: 16 },
  pillText: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
