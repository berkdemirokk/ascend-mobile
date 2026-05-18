// MonthlyWrappedCard — Spotify-Wrapped-style shareable image at
// Instagram Stories dimensions (1080×1920). Rendered off-screen, captured
// via react-native-view-shot, then handed to expo-sharing for upload to
// IG Stories, Snapchat, Twitter, WhatsApp, etc.
//
// Why this exists: people will share THEIR stats, not the app's
// marketing copy. Spotify Wrapped's entire viral moment is people
// posting their year-end card to social. Same pattern, monthly,
// for discipline metrics.
//
// Built mobile-first but rendered larger than screen — react-native-view-shot
// captures the View at its declared size regardless of viewport. The
// component is positioned off-screen by the consumer (negative left)
// so it doesn't visually disturb the UI.

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCharacterStage } from '../config/characterEvolution';

// Instagram Stories canonical size — full-bleed on phones, fits IG/SC/X.
const W = 1080;
const H = 1920;

// Map TR/EN month indexes → display name (we don't pull from i18n for
// the shareable since we want stable text regardless of caller locale).
const MONTHS_TR = [
  'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
  'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK',
];
const MONTHS_EN = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * @param {Object} props
 * @param {Object} props.report  TransformationReport object (from buildTransformationReport)
 * @param {number} [props.year]  display year, defaults to current
 * @param {number} [props.monthIdx]  display month 0-11, defaults to last month
 * @param {string} [props.lang]  'tr' | 'en'
 * @param {string} [props.username]  user's anon name or display name
 */
const MonthlyWrappedCard = forwardRef(function MonthlyWrappedCard(
  { report, year, monthIdx, lang = 'tr', username = '' },
  ref,
) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = monthIdx ?? now.getMonth();
  const months = lang === 'en' ? MONTHS_EN : MONTHS_TR;
  const monthLabel = months[m] || '';

  // Safe report — every field optional. Real card if data exists, else
  // blanks at zero.
  const r = report || {};
  const lessonsTotal = r.lessonsTotal ?? 0;
  const hoursOfDiscipline = r.hoursOfDiscipline ?? 0;
  const activeDays = r.activeDays ?? 0;
  const longestStreak = r.longestStreak ?? 0;
  const totalReflectionWords = r.totalReflectionWords ?? 0;
  const topTopics = r.topReflectionTopics ?? [];

  // Character stage — same evolution as Profile hero.
  const character = getCharacterStage(longestStreak);
  const characterLabel =
    lang === 'en'
      ? characterLabelsEn[character.id] || ''
      : characterLabelsTr[character.id] || '';

  return (
    <View ref={ref} style={styles.canvas} collapsable={false}>
      <LinearGradient
        colors={['#1E1B4B', '#4338CA', '#7C3AED', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Big abstract circles for visual depth (faux glow) */}
        <View style={[styles.circle, styles.circleTopRight]} />
        <View style={[styles.circle, styles.circleBottomLeft]} />

        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>
            {(lang === 'en' ? 'ASCEND · MONTHLY RECAP' : 'ASCEND · AYLIK RAPOR')}
          </Text>
          <Text style={styles.monthHero}>{monthLabel}</Text>
          <Text style={styles.yearSub}>{y}</Text>
        </View>

        {/* Hero number — the big "wow" stat */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroNumber}>{lessonsTotal}</Text>
          <Text style={styles.heroLabel}>
            {lang === 'en' ? 'LESSONS OF DISCIPLINE' : 'DİSİPLİN DERSİ'}
          </Text>
        </View>

        {/* Stats grid — 2×2 of secondary numbers */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{hoursOfDiscipline}</Text>
            <Text style={styles.statLabel}>
              {lang === 'en' ? 'HOURS' : 'SAAT'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{activeDays}</Text>
            <Text style={styles.statLabel}>
              {lang === 'en' ? 'ACTIVE DAYS' : 'AKTİF GÜN'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{longestStreak}</Text>
            <Text style={styles.statLabel}>
              {lang === 'en' ? 'STREAK' : 'SERİ'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{totalReflectionWords}</Text>
            <Text style={styles.statLabel}>
              {lang === 'en' ? 'WORDS WRITTEN' : 'KELİME YAZILDI'}
            </Text>
          </View>
        </View>

        {/* Character identity badge */}
        <View style={styles.characterBlock}>
          <Text style={styles.characterEmoji}>{character.emoji}</Text>
          <Text style={styles.characterEyebrow}>
            {(lang === 'en' ? 'YOU ARE NOW' : 'ARTIK SENSİN')}
          </Text>
          <Text style={styles.characterTitle}>{characterLabel}</Text>
        </View>

        {/* Top reflection topics — what the user thinks about most */}
        {topTopics.length > 0 ? (
          <View style={styles.topicsBlock}>
            <Text style={styles.topicsLabel}>
              {lang === 'en' ? 'WHAT YOU THINK ABOUT' : 'NEYE KAFA YORUYORSUN'}
            </Text>
            <View style={styles.topicsRow}>
              {topTopics.slice(0, 3).map((t) => (
                <View key={t} style={styles.topicChip}>
                  <Text style={styles.topicText}>
                    {topicEmojis[t] || '•'}{' '}
                    {(lang === 'en' ? topicLabelsEn[t] : topicLabelsTr[t]) || t}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Footer brand stamp */}
        <View style={styles.footer}>
          <Text style={styles.footerApp}>ASCEND: MONK MODE</Text>
          <Text style={styles.footerSub}>
            {username
              ? `@${String(username).toLowerCase()}`
              : (lang === 'en' ? '5 minutes a day' : 'günde 5 dakika')}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
});

// ─── Static label / emoji maps (avoid i18n at capture time) ───────────

const characterLabelsTr = {
  beginner: 'ACEMİ',
  apprentice: 'ÇIRAK',
  warrior: 'SAVAŞÇI',
  monk: 'KEŞİŞ',
  sage: 'BİLGE',
  legend: 'EFSANE',
};
const characterLabelsEn = {
  beginner: 'BEGINNER',
  apprentice: 'APPRENTICE',
  warrior: 'WARRIOR',
  monk: 'MONK',
  sage: 'SAGE',
  legend: 'LEGEND',
};
const topicEmojis = {
  detox: '📱',
  body: '💪',
  mind: '🧠',
  money: '💰',
  social: '❤️',
};
const topicLabelsTr = {
  detox: 'DOPAMİN DETOKS',
  body: 'BEDEN',
  mind: 'ZİHİN',
  money: 'PARA',
  social: 'İLİŞKİLER',
};
const topicLabelsEn = {
  detox: 'DOPAMINE DETOX',
  body: 'BODY',
  mind: 'MIND',
  money: 'MONEY',
  social: 'RELATIONSHIPS',
};

const styles = StyleSheet.create({
  canvas: {
    width: W,
    height: H,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 72,
    paddingVertical: 100,
    overflow: 'hidden',
  },

  // Decorative background circles
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(253, 224, 71, 0.15)',
  },
  circleTopRight: {
    width: 600,
    height: 600,
    top: -200,
    right: -200,
  },
  circleBottomLeft: {
    width: 500,
    height: 500,
    bottom: -180,
    left: -180,
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
  },

  // Header
  headerBlock: {
    marginTop: 20,
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  monthHero: {
    color: '#FFFFFF',
    fontSize: 130,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 140,
    marginTop: 18,
  },
  yearSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 50,
    fontWeight: '700',
    marginTop: -8,
    letterSpacing: 1,
  },

  // Hero stat
  heroBlock: {
    marginTop: 100,
  },
  heroNumber: {
    color: '#FDE047',
    fontSize: 220,
    fontWeight: '900',
    letterSpacing: -8,
    lineHeight: 220,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 24,
  },
  heroLabel: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 8,
  },

  // 2x2 grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 80,
    gap: 30,
  },
  statBox: {
    width: (W - 72 * 2 - 30) / 2,
    paddingVertical: 26,
    paddingHorizontal: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 90,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 100,
  },
  statLabel: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
  },

  // Character
  characterBlock: {
    marginTop: 80,
    alignItems: 'flex-start',
  },
  characterEmoji: {
    fontSize: 120,
    marginBottom: 12,
  },
  characterEyebrow: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  characterTitle: {
    color: '#FFFFFF',
    fontSize: 88,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 6,
  },

  // Topics
  topicsBlock: {
    marginTop: 60,
  },
  topicsLabel: {
    color: 'rgba(253, 224, 71, 0.95)',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 20,
  },
  topicsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  topicChip: {
    paddingVertical: 14,
    paddingHorizontal: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
  },
  topicText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 100,
    left: 72,
    right: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerApp: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 3,
  },
  footerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default MonthlyWrappedCard;
