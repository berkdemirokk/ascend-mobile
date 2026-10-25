import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from './AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW } from '../config/lightTheme';

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'ascender_marcus', xp: 4820, streak: 42, isUser: false },
  { rank: 2, name: 'ascender_seneca', xp: 4210, streak: 35, isUser: false },
  { rank: 3, name: 'ascender_zeno', xp: 3950, streak: 28, isUser: false },
  { rank: 4, name: 'ascender_epictetus', xp: 3410, streak: 21, isUser: false },
  { rank: 5, name: 'ascender_cleanthes', xp: 2980, streak: 19, isUser: false },
  { rank: 6, name: 'ascender_chrysippus', xp: 2650, streak: 15, isUser: false },
  { rank: 7, name: 'ascender_musonius', xp: 2320, streak: 14, isUser: false },
  { rank: 8, name: 'ascender_panaetius', xp: 2110, streak: 12, isUser: false },
  { rank: 9, name: 'ascender_posidonius', xp: 1890, streak: 10, isUser: false },
  { rank: 10, name: 'ascender_diogenes', xp: 1650, streak: 7, isUser: false },
];

export function LeaderboardCard({ userXp = 0, userStreak = 0, anonUsername = 'ascender_you' }) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' | 'allTime'
  const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR';

  const displayList = [...MOCK_LEADERBOARD];
  let userRank = 11;
  for (let i = 0; i < displayList.length; i++) {
    if (userXp > displayList[i].xp) {
      userRank = i + 1;
      break;
    }
  }

  const currentUserItem = {
    rank: userRank,
    name: anonUsername || 'ascender_you',
    xp: userXp,
    streak: userStreak,
    isUser: true,
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="emoji-events" size={20} color={LT.primary} />
          <Text style={styles.title}>
            {t('leaderboard.title', 'LİDERLİK TABLOSU')}
          </Text>
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'weekly' && styles.tabBtnActive]}
            onPress={() => setActiveTab('weekly')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'weekly' && styles.tabBtnTextActive,
              ]}
            >
              {t('leaderboard.weekly', 'Haftalık')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'allTime' && styles.tabBtnActive]}
            onPress={() => setActiveTab('allTime')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'allTime' && styles.tabBtnTextActive,
              ]}
            >
              {t('leaderboard.allTime', 'Tüm Zamanlar')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.subtitle}>
        {t(
          'leaderboard.subtitle',
          'Disiplin topluluğundaki konumun. Anonim rumuzlar kullanılır.',
        )}
      </Text>

      {/* User's Current Standing Banner */}
      <View style={styles.userStanding}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>#{currentUserItem.rank}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {currentUserItem.name} ({t('common.you', 'Sen')})
          </Text>
          <Text style={styles.userStats}>
            {currentUserItem.streak} {t('common.days', 'Gün')} · {currentUserItem.xp.toLocaleString(locale)} XP
          </Text>
        </View>
        <MaterialIcons name="star" size={22} color={LT.primary} />
      </View>

      {/* Top 5 list */}
      <View style={styles.list}>
        {displayList.slice(0, 5).map((item) => (
          <View
            key={item.rank}
            style={[styles.row, item.rank === 1 && styles.firstRow]}
          >
            <View
              style={[
                styles.rowRank,
                item.rank === 1 && styles.goldRank,
                item.rank === 2 && styles.silverRank,
                item.rank === 3 && styles.bronzeRank,
              ]}
            >
              <Text
                style={[
                  styles.rowRankText,
                  item.rank <= 3 && styles.topRankText,
                ]}
              >
                {item.rank}
              </Text>
            </View>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowStreak}>
                {t('leaderboard.streakDays', '{{count}} gün seri', {
                  count: item.streak,
                })}
              </Text>
            </View>

            <Text style={styles.rowXp}>
              {item.xp.toLocaleString(locale)} XP
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.xl,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    ...LT_SHADOW.ambient,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: LT.surfaceContainerHigh,
    borderRadius: LT_RADII.pill,
    padding: 2,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: LT_RADII.pill,
  },
  tabBtnActive: {
    backgroundColor: LT.surfaceContainerLowest,
    ...LT_SHADOW.ambient,
  },
  tabBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
  },
  tabBtnTextActive: {
    color: LT.onSurface,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    marginBottom: 14,
    lineHeight: 16,
  },
  userStanding: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: LT_RADII.lg,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: LT_RADII.pill,
    backgroundColor: LT.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: LT.onPrimary,
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: LT.onSurface,
  },
  userStats: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    marginTop: 2,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: LT_RADII.md,
  },
  firstRow: {
    backgroundColor: 'rgba(227, 18, 18, 0.04)',
  },
  rowRank: {
    width: 26,
    height: 26,
    borderRadius: LT_RADII.pill,
    backgroundColor: LT.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldRank: {
    backgroundColor: '#F59E0B',
  },
  silverRank: {
    backgroundColor: '#94A3B8',
  },
  bronzeRank: {
    backgroundColor: '#B45309',
  },
  rowRankText: {
    fontSize: 11,
    fontWeight: '800',
    color: LT.onSurfaceVariant,
  },
  topRankText: {
    color: '#FFFFFF',
  },
  rowName: {
    fontSize: 13,
    fontWeight: '700',
    color: LT.onSurface,
  },
  rowStreak: {
    fontSize: 10,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
  },
  rowXp: {
    fontSize: 12,
    fontWeight: '800',
    color: LT.primaryContainer,
  },
});
