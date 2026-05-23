// ReflectionsScreen — shows the user's lesson reflections grouped by path.
// Pulls from pathProgress.reflections in AppContext (already stored on
// lesson completion).

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '../contexts/AppContext';
import { PATHS } from '../data/paths';
import { LT, LT_RADIUS } from '../config/lightTheme';

export default function ReflectionsScreen({ navigation }) {
  const { t } = useTranslation();
  const { pathProgress } = useApp();

  const sections = useMemo(() => {
    const out = [];
    for (const p of PATHS) {
      const reflections = pathProgress?.[p.id]?.reflections || {};
      const entries = Object.entries(reflections)
        .filter(([, text]) => text && text.trim())
        .sort((a, b) => {
          // Sort by lesson order desc (most recent first)
          const oa = parseInt(a[0].split('-').pop(), 10);
          const ob = parseInt(b[0].split('-').pop(), 10);
          return ob - oa;
        });
      if (entries.length > 0) {
        out.push({ path: p, entries });
      }
    }
    return out;
  }, [pathProgress]);

  // Total count for the hero header — "12 yansıma · ~360 kelime" tier
  // of stats. Makes the archive feel like something the user is
  // building, not a one-off log.
  const stats = useMemo(() => {
    let count = 0;
    let words = 0;
    for (const s of sections) {
      for (const [, text] of s.entries) {
        count += 1;
        words += text.trim().split(/\s+/).length;
      }
    }
    return { count, words };
  }, [sections]);

  // Featured reflection — the longest one. Surfaces the user's most
  // substantial piece of writing as the centerpiece of the screen.
  // Empirical observation: users who write 100+ words once tend to
  // write 100+ words again — featuring the heaviest entry reminds
  // them they're capable of going deep.
  const featured = useMemo(() => {
    let best = null;
    for (const s of sections) {
      for (const [lessonId, text] of s.entries) {
        const len = text.trim().length;
        if (!best || len > best.len) {
          const order = parseInt(lessonId.split('-').pop(), 10);
          best = {
            path: s.path,
            lessonId,
            lessonOrder: order,
            text: text.trim(),
            len,
          };
        }
      }
    }
    return best && best.len >= 80 ? best : null;
  }, [sections]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back" size={22} color={LT.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {t('reflections.title', 'Yansımalarım')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="auto-stories" size={48} color={LT.outline} />
            </View>
            <Text style={styles.emptyTitle}>
              {t('reflections.emptyTitle', 'Henüz yansıma yok')}
            </Text>
            <Text style={styles.emptyBody}>
              {t(
                'reflections.emptyBody',
                'Ders tamamladıkça yazdığın yansımalar burada birikecek.',
              )}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Stats hero — investment-feedback. Surfaces the count
                and rough word total so the archive feels like a
                real artifact the user has been building. */}
            <View style={styles.statsHero}>
              <View style={styles.statsHeroCell}>
                <Text style={styles.statsHeroValue}>{stats.count}</Text>
                <Text style={styles.statsHeroLabel}>
                  {t('reflections.statCount', 'YANSIMA')}
                </Text>
              </View>
              <View style={styles.statsHeroDivider} />
              <View style={styles.statsHeroCell}>
                <Text style={styles.statsHeroValue}>~{stats.words}</Text>
                <Text style={styles.statsHeroLabel}>
                  {t('reflections.statWords', 'KELİME')}
                </Text>
              </View>
            </View>

            <Text style={styles.subtitle}>
              {t(
                'reflections.subtitle',
                'Geçmiş derslerde yazdığın düşünceler. Geri dönüp oku, kendi yolculuğunu hatırla.',
              )}
            </Text>

            {/* Featured — the longest reflection. Reminds the user
                they have already gone deep once. */}
            {featured ? (
              <View style={styles.featuredCard}>
                <View style={styles.featuredHeader}>
                  <MaterialIcons
                    name="star"
                    size={14}
                    color={LT.primaryContainer}
                  />
                  <Text style={styles.featuredLabel}>
                    {t('reflections.featuredLabel', 'EN DERİN YAZIN')}
                  </Text>
                </View>
                <Text style={styles.featuredSub} numberOfLines={1}>
                  {t(`paths.${featured.path.id}.title`, featured.path.id)}
                  {' · '}
                  {t('path.lessonLabel', 'Ders')} {featured.lessonOrder}
                </Text>
                <Text style={styles.featuredText}>"{featured.text}"</Text>
              </View>
            ) : null}

            {sections.map((section) => (
              <View key={section.path.id} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: `${section.path.color}22`, borderColor: `${section.path.color}55` },
                    ]}
                  >
                    <MaterialIcons
                      name={section.path.materialIcon}
                      size={18}
                      color={section.path.color}
                    />
                  </View>
                  <Text style={styles.sectionTitle}>
                    {t(`paths.${section.path.id}.title`, section.path.id)}
                  </Text>
                  <Text style={styles.sectionCount}>
                    {section.entries.length}
                  </Text>
                </View>

                {section.entries.map(([lessonId, text]) => {
                  const lessonOrder = parseInt(lessonId.split('-').pop(), 10);
                  const lessonTitle = t(
                    `lessons.${section.path.id}.${lessonOrder}.title`,
                    `Ders ${lessonOrder}`,
                  );
                  return (
                    <View key={lessonId} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardLessonNum}>
                          DERS {lessonOrder}
                        </Text>
                        <Text style={styles.cardLessonTitle} numberOfLines={1}>
                          {lessonTitle}
                        </Text>
                      </View>
                      <Text style={styles.cardText}>{text}</Text>
                    </View>
                  );
                })}
              </View>
            ))}

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

// Theme-aware stylesheet factory. See `src/config/theme.js`.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
    backgroundColor: LT.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  scroll: { padding: 20, paddingTop: 16 },
  // Stats hero — count + word total in a single horizontal block.
  // Investment-feedback surface: the user sees the archive grow.
  statsHero: {
    flexDirection: 'row',
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: LT_RADIUS.lg,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  statsHeroCell: {
    flex: 1,
    alignItems: 'center',
  },
  statsHeroDivider: {
    width: 1,
    backgroundColor: LT.outlineVariant,
    marginVertical: 8,
  },
  statsHeroValue: {
    fontSize: 24,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 4,
  },
  statsHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: LT.onSurfaceVariant,
  },
  // Featured (longest) reflection card. Slightly emphasized border
  // to draw the eye — this is the user's heaviest piece of writing.
  featuredCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  featuredLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: LT.primaryContainer,
  },
  featuredSub: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    marginBottom: 8,
  },
  featuredText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: LT.onSurface,
    lineHeight: 20,
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionTitle: {
    color: LT.onSurface,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionCount: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: LT.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: LT_RADIUS.pill,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    minWidth: 28,
    textAlign: 'center',
  },

  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: LT_RADIUS.lg,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardLessonNum: {
    color: LT.primaryContainer,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227, 18, 18, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardLessonTitle: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardText: {
    color: LT.onSurface,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    color: LT.onSurface,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyBody: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
