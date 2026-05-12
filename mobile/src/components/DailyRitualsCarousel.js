// DailyRitualsCarousel — horizontally swipeable row of four daily
// micro-interactions that previously each took a full-width Home card.
// Each tile is compact (~ 78% of the screen wide so the next one peeks).
//
// Tiles:
//   1. Mystery Bonus  — tap to complete the daily challenge for +25 XP
//   2. Mystery Box    — tap to open today's variable-reward box
//   3. Mood Check-in  — pick today's mood (collapses to picked-state)
//   4. Daily Quote    — Stoic / discipline quote of the day
//
// Each tile is a thin presentational wrapper. The carousel keeps the
// existing daily-action logic out of the wrapper — handlers are passed
// in from the Home screen exactly as before.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS, LT_SPACING } from '../config/lightTheme';
import { getDailyQuote } from '../config/quotes';
import { getCurrentLanguage } from '../i18n';
import { hapticImpactLight, hapticImpactMedium } from '../services/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_WIDTH = Math.round(SCREEN_WIDTH * 0.78);
const TILE_GAP = 12;

// ─── Individual tile components ───────────────────────────────────────────

function ChallengeTile({ challenge, done, onComplete }) {
  const { t } = useTranslation();
  if (!challenge) return null;
  return (
    <TouchableOpacity
      onPress={done ? undefined : onComplete}
      activeOpacity={done ? 1 : 0.85}
      style={[styles.tile, done && styles.tileDone]}
    >
      <Text style={styles.tileEmoji}>{challenge.icon}</Text>
      <Text style={[styles.tileLabel, done && styles.tileLabelDone]}>
        {done
          ? t('home.challengeDone', 'BONUS TAMAMLANDI')
          : t('home.challengeLabel', "BUGÜNÜN BONUSU · +25 XP")}
      </Text>
      <Text style={styles.tileTitle} numberOfLines={2}>
        {t(challenge.titleKey, challenge.titleFallback)}
      </Text>
      <Text style={styles.tileBody} numberOfLines={2}>
        {t(challenge.bodyKey, challenge.bodyFallback)}
      </Text>
      {done ? (
        <View style={styles.checkRow}>
          <MaterialIcons name="check-circle" size={18} color={LT.primaryContainer} />
        </View>
      ) : (
        <View style={styles.checkRow}>
          <MaterialIcons name="bolt" size={18} color={LT.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function MysteryBoxTile({ alreadyOpenedToday, lastReward, rewards, onOpen }) {
  const { t } = useTranslation();
  const reward = alreadyOpenedToday && lastReward
    ? rewards.find((r) => r.id === lastReward)
    : null;

  if (reward) {
    return (
      <View style={[styles.tile, styles.tileDone]}>
        <Text style={styles.tileEmoji}>{reward.icon}</Text>
        <Text style={[styles.tileLabel, styles.tileLabelDone]}>
          {t('mysteryBox.todayReward', "TODAY'S MYSTERY BONUS")}
        </Text>
        <Text style={styles.tileTitle}>
          {reward.kind === 'xp' && `+${reward.value} XP`}
          {reward.kind === 'freeze' && t('mysteryBox.gotFreeze', '+1 Streak Freeze')}
          {reward.kind === 'streak_bonus' && t('mysteryBox.gotProtect', '+1 Streak Protect')}
        </Text>
        <Text style={styles.tileBody} numberOfLines={2}>
          {t('mysteryBox.comeBackTomorrow', 'Come back tomorrow for another reward.')}
        </Text>
        <View style={styles.checkRow}>
          <MaterialIcons name="check-circle" size={18} color={LT.primaryContainer} />
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => {
        hapticImpactMedium();
        onOpen?.();
      }}
      activeOpacity={0.85}
      style={[styles.tile, styles.tileAccent]}
    >
      <Text style={styles.tileEmoji}>🎁</Text>
      <Text style={[styles.tileLabel, styles.tileLabelAccent]}>
        {t('mysteryBox.label', 'DAILY MYSTERY BOX')}
      </Text>
      <Text style={styles.tileTitle}>
        {t('mysteryBox.openCta', 'Tap to open')}
      </Text>
      <Text style={styles.tileBody} numberOfLines={2}>
        {t('mysteryBox.hint', 'XP, streak freeze, or rare bonus inside.')}
      </Text>
      <View style={styles.checkRow}>
        <MaterialIcons name="chevron-right" size={20} color={LT.primary} />
      </View>
    </TouchableOpacity>
  );
}

function MoodTile({ todayMood, onPick, moodOptions }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!todayMood);

  if (todayMood && !expanded) {
    const picked = moodOptions.find((m) => m.id === todayMood);
    if (picked) {
      const labelKey = `onboarding.mood${picked.id.charAt(0).toUpperCase()}${picked.id.slice(1)}`;
      return (
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          activeOpacity={0.85}
          style={[styles.tile, styles.tileDone]}
        >
          <Text style={styles.tileEmoji}>{picked.emoji}</Text>
          <Text style={[styles.tileLabel, styles.tileLabelDone]}>
            {t('moodCheckIn.todayPill', "TODAY'S MOOD")}
          </Text>
          <Text style={styles.tileTitle}>{t(labelKey)}</Text>
          <Text style={styles.tileBody}>
            {t('moodCheckIn.tapToChange', 'Değiştirmek için dokun')}
          </Text>
          <View style={styles.checkRow}>
            <MaterialIcons name="edit" size={16} color={LT.onSurfaceVariant} />
          </View>
        </TouchableOpacity>
      );
    }
  }

  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>
        {t('moodCheckIn.label', 'MOOD CHECK')}
      </Text>
      <Text style={styles.tileTitle}>
        {t('moodCheckIn.title', 'How are you feeling today?')}
      </Text>
      <View style={styles.moodRow}>
        {moodOptions.map((m) => (
          <TouchableOpacity
            key={m.id}
            onPress={() => {
              hapticImpactLight();
              onPick?.(m.id);
              setExpanded(false);
            }}
            activeOpacity={0.85}
            style={styles.moodBtn}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function QuoteTile() {
  const quote = useMemo(() => getDailyQuote(), []);
  const lang = String(getCurrentLanguage() || 'tr').toLowerCase().slice(0, 2);
  const text = lang === 'en' ? quote.en : quote.tr;

  const handleLongPress = async () => {
    try {
      hapticImpactLight();
      await Share.share({
        message: `"${text}" — ${quote.author}\n\nAscend: Monk Mode`,
      });
    } catch {}
  };

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      delayLongPress={400}
      activeOpacity={0.92}
      style={[styles.tile, styles.tileQuote]}
    >
      <Text style={styles.quoteMark}>"</Text>
      <Text style={styles.quoteText} numberOfLines={4}>
        {text}
      </Text>
      <Text style={styles.quoteAuthor}>— {quote.author}</Text>
    </TouchableOpacity>
  );
}

// ─── Carousel wrapper ─────────────────────────────────────────────────────

export default function DailyRitualsCarousel({
  // Challenge
  challenge,
  challengeDone,
  onCompleteChallenge,
  // Mystery box
  alreadyOpenedBox,
  lastReward,
  rewards,
  onOpenBox,
  // Mood
  todayMood,
  onPickMood,
  moodOptions,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      decelerationRate="fast"
      snapToInterval={TILE_WIDTH + TILE_GAP}
      snapToAlignment="start"
    >
      <ChallengeTile
        challenge={challenge}
        done={challengeDone}
        onComplete={onCompleteChallenge}
      />
      <MysteryBoxTile
        alreadyOpenedToday={alreadyOpenedBox}
        lastReward={lastReward}
        rewards={rewards}
        onOpen={onOpenBox}
      />
      <MoodTile
        todayMood={todayMood}
        onPick={onPickMood}
        moodOptions={moodOptions}
      />
      <QuoteTile />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingBottom: 16,
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_WIDTH,
    minHeight: 150,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  tileAccent: {
    borderColor: LT.primary,
    borderWidth: 1.5,
  },
  tileDone: {
    backgroundColor: LT.surfaceContainerLow,
  },
  tileQuote: {
    justifyContent: 'space-between',
  },
  tileEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: LT.primary,
    marginBottom: 2,
  },
  tileLabelAccent: {
    color: LT.primary,
  },
  tileLabelDone: {
    color: LT.onSurfaceVariant,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: LT.onSurface,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  tileBody: {
    fontSize: 12,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    lineHeight: 16,
  },
  checkRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  moodBtn: {
    flex: 1,
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 26,
  },
  quoteMark: {
    fontSize: 36,
    fontWeight: '900',
    color: LT.primary,
    lineHeight: 36,
    marginBottom: 2,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '600',
    color: LT.onSurface,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  quoteAuthor: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: LT.onSurfaceVariant,
    marginTop: 6,
  },
});
