// StreakCalendar — GitHub-style heatmap showing last 8 weeks of activity.
// Each cell = 1 day, color intensity = # lessons that day.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const WEEKS = 8;
const DAYS_PER_WEEK = 7;
const CELL_SIZE = 14;
const CELL_GAP = 3;

// Vivid Impact light theme — red intensity scale.
function getColorForCount(count) {
  if (!count) return '#EEEEEE';      // empty (surfaceContainer)
  if (count === 1) return '#FCC8C8'; // 25% red
  if (count === 2) return '#F47373'; // 50% red
  if (count === 3) return '#ED2D2D'; // 75% red
  return '#B70006';                  // 4+ lessons (primary)
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function StreakCalendar({ lessonHistory = {} }) {
  const { t } = useTranslation();

  // Build grid: rows = days of week, cols = weeks (oldest left, newest right)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find MONDAY of current week (Turkish week starts on Monday).
  // ISO weekday: Mon=0, Sun=6 via the `(getDay() + 6) % 7` trick.
  const dayOfWeek = (today.getDay() + 6) % 7;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - dayOfWeek);

  const grid = []; // [day][week]
  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    const row = [];
    for (let week = 0; week < WEEKS; week++) {
      const cellDate = new Date(startOfThisWeek);
      cellDate.setDate(startOfThisWeek.getDate() - (WEEKS - 1 - week) * DAYS_PER_WEEK + day);
      // Skip future days (after today)
      const isFuture = cellDate.getTime() > today.getTime();
      const key = formatDateKey(cellDate);
      const count = lessonHistory[key] || 0;
      row.push({ count, isFuture, key });
    }
    grid.push(row);
  }

  // Day labels — 2-letter to disambiguate Pazar / Pazartesi / Perşembe
  // (all start with "P" in Turkish). Monday-first to match `dayOfWeek`
  // calculation above.
  const dayLabels = [
    t('calendar.mon', 'Pzt'),
    t('calendar.tue', 'Sal'),
    t('calendar.wed', 'Çar'),
    t('calendar.thu', 'Per'),
    t('calendar.fri', 'Cum'),
    t('calendar.sat', 'Cmt'),
    t('calendar.sun', 'Paz'),
  ];

  // Total lessons in period
  const totalInPeriod = grid.flat().reduce((s, c) => s + (c.count || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('calendar.title', 'Aktivite Haritası')}
        </Text>
        <Text style={styles.subtitle}>
          {t(
            'calendar.subtitle',
            '{{count}} ders son 8 hafta',
            { count: totalInPeriod },
          )}
        </Text>
      </View>

      <View style={styles.gridContainer}>
        <View style={styles.dayLabels}>
          {dayLabels.map((label, idx) => (
            <Text
              key={idx}
              style={[
                styles.dayLabel,
                // Show only Mon, Wed, Fri to save space
                idx % 2 === 0 ? null : { opacity: 0 },
              ]}
            >
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((row, dayIdx) => (
            <View key={dayIdx} style={styles.gridRow}>
              {row.map((cell, weekIdx) => (
                <View
                  key={`${dayIdx}-${weekIdx}`}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cell.isFuture
                        ? 'transparent'
                        : getColorForCount(cell.count),
                      opacity: cell.isFuture ? 0 : 1,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>
          {t('calendar.less', 'Az')}
        </Text>
        {[0, 1, 2, 3, 4].map((c) => (
          <View
            key={c}
            style={[styles.legendCell, { backgroundColor: getColorForCount(c) }]}
          />
        ))}
        <Text style={styles.legendLabel}>
          {t('calendar.more', 'Çok')}
        </Text>
      </View>
    </View>
  );
}

// Vivid Impact light theme styles.
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  header: { marginBottom: 14 },
  title: {
    color: '#1A1C1C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#5E3F3A',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dayLabels: {
    justifyContent: 'space-between',
    paddingTop: 1,
  },
  dayLabel: {
    color: '#936E69',
    fontSize: 9,
    fontWeight: '700',
    height: CELL_SIZE,
    lineHeight: CELL_SIZE,
  },
  grid: {
    flex: 1,
    gap: CELL_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    flexShrink: 0,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  legendLabel: {
    color: '#936E69',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
