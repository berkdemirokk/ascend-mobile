// LessonSearchScreen — search across all 250 lessons by title, teaching
// excerpt, action, or pro tip. Tapping a result deep-links into the lesson.
// Plain client-side text match against the loaded i18n bundle, no backend.

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { PATHS } from '../data/paths';
import { LT, LT_RADIUS, LT_SPACING } from '../config/lightTheme';

export default function LessonSearchScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');

  // Build a flat searchable index once per render. ~250 entries — small
  // enough to filter on every keystroke without debouncing.
  const index = useMemo(() => {
    const entries = [];
    const lessons = i18n?.getResourceBundle?.(i18n.language, 'translation')?.lessons || {};
    for (const path of PATHS) {
      const pathLessons = lessons[path.id] || {};
      for (let i = 1; i <= path.duration; i++) {
        const l = pathLessons[String(i)];
        if (!l) continue;
        const haystack = [
          l.title || '',
          l.teaching || '',
          l.action || '',
          l.proTip || '',
        ]
          .join(' ')
          .toLowerCase();
        entries.push({
          pathId: path.id,
          order: i,
          title: l.title || '',
          teaching: l.teaching || '',
          haystack,
        });
      }
    }
    return entries;
  }, [i18n.language]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return index
      .filter((entry) => entry.haystack.includes(q))
      .slice(0, 30);
  }, [query, index]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        Keyboard.dismiss();
        navigation.replace('Lesson', {
          pathId: item.pathId,
          lessonId: `${item.pathId}-${item.order}`,
        });
      }}
      style={styles.row}
      activeOpacity={0.85}
    >
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{item.order}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {item.teaching}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={LT.onSurfaceVariant} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />

      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Geri')}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <MaterialIcons name="arrow-back" size={22} color={LT.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {t('search.title', 'Ders ara')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color={LT.onSurfaceVariant} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder', 'Anahtar kelime — odak, sabah, dopamin...')}
          placeholderTextColor={LT.outline}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('search.clear', 'Aramayı temizle')}
          >
            <MaterialIcons name="close" size={18} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
        ) : null}
      </View>

      {query.length < 2 ? (
        <View style={styles.helpBox}>
          <MaterialIcons name="lightbulb" size={28} color={LT.outline} />
          <Text style={styles.helpText}>
            {t(
              'search.helpText',
              'En az 2 harfle ara — başlık, öğreti veya aksiyon içinde geçerse çıkar.',
            )}
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.helpBox}>
          <Text style={styles.helpEmoji}>🤷</Text>
          <Text style={styles.helpText}>
            {t('search.noResults', 'Sonuç yok. Başka kelime dene.')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.pathId}-${item.order}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainer,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: LT.onSurface,
    letterSpacing: 0,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: LT_SPACING.containerMargin,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: LT_RADIUS.lg,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: LT.onSurface,
    fontWeight: '600',
    paddingVertical: 0,
  },

  listContent: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingBottom: 32,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '900',
  },
  rowTitle: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  rowSub: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },

  helpBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  helpEmoji: { fontSize: 40 },
  helpText: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
  },
});
