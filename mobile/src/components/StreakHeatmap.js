// 30-Day Streak Heatmap — a GitHub-style 7×5 grid showing the user's
// activity over the last 30 days. Each cell = one day, color intensity
// = number of lessons that day. Strong visual sunk-cost signal:
// "look how much I've put into this".
//
// Reads from `lessonHistory` ({ 'YYYY-MM-DD': lessonCount }). The
// grid is calendar-aligned to the current weekday (Mon-first) so the
// rightmost column is "today".

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';

// 5 weeks × 7 days = 35 cells. We show the most recent 30 days +
// padding on the left for visual rhythm (the empty leading cells
// are styled muted so they read as "not yet").
const TOTAL_CELLS = 35;
const COLS = 7;

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * @param {Object} props
 * @param {Object<string, number>} props.lessonHistory  date → lesson count
 */
export default function StreakHeatmap({ lessonHistory }) {
  const { t } = useTranslation();

  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out = [];
    // Build 35 cells ending today on the bottom-right.
    for (let i = TOTAL_CELLS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = fmtDate(d);
      const count = lessonHistory?.[key] || 0;
      out.push({ key, count, dateStr: key });
    }
    return out;
  }, [lessonHistory]);

  const totalLessons = cells.reduce((s, c) => s + c.count, 0);
  const activeDays = cells.filter((c) => c.count > 0).length;

  // Intensity scale — 0 = empty, 1-2 = light, 3-4 = mid, 5+ = strong.
  const intensity = (count) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 2) return 2;
    if (count <= 4) return 3;
    return 4;
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {t('heatmap.title', 'LAST 30 DAYS')}
        </Text>
        <Text style={styles.summary}>
          {t('heatmap.summary', { lessons: totalLessons, days: activeDays })}
        </Text>
      </View>

      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          const row = Math.floor(idx / COLS);
          const col = idx % COLS;
          const level = intensity(cell.count);
          return (
            <View
              key={cell.key}
              style={[
                styles.cell,
                styles[`cell${level}`],
                { marginRight: col === COLS - 1 ? 0 : 4 },
                { marginBottom: row === Math.floor((TOTAL_CELLS - 1) / COLS) ? 0 : 4 },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendLabel}>{t('heatmap.less', 'LESS')}</Text>
        {[0, 1, 2, 3, 4].map((level) => (
          <View key={level} style={[styles.legendCell, styles[`cell${level}`]]} />
        ))}
        <Text style={styles.legendLabel}>{t('heatmap.more', 'MORE')}</Text>
      </View>
    </View>
  );
}

const CELL_SIZE = 16;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 16,
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  summary: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: CELL_SIZE * COLS + 4 * (COLS - 1),
    alignSelf: 'center',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
  },
  cell0: { backgroundColor: LT.outlineVariant },
  cell1: { backgroundColor: '#C7D2FE' },
  cell2: { backgroundColor: '#818CF8' },
  cell3: { backgroundColor: '#6366F1' },
  cell4: { backgroundColor: '#4338CA' },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendLabel: {
    color: LT.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginHorizontal: 4,
  },
});
