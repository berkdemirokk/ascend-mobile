// Daily discipline quote card — shown at the top of the Home screen so
// the first thing the user sees every morning is a hook (curiosity:
// "what's today's quote?"). Refreshes at local midnight; quote is
// deterministic per-day across all devices for any shareable moments.
//
// Tappable: long-press → copy to clipboard (system feedback only, no
// toast — keeps the UI clean). Future versions can add "Share quote".

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { LT } from '../config/lightTheme';
import { getDailyQuote } from '../config/quotes';
import { getCurrentLanguage } from '../i18n';
import { hapticImpactLight } from '../services/haptics';

export default function DailyQuoteCard() {
  // Recompute only when day changes. The function bucket-by-date so it's
  // stable across re-renders within a single day.
  const quote = useMemo(() => getDailyQuote(), []);
  const lang = getCurrentLanguage();
  const text = lang === 'tr' ? quote.tr : quote.en;

  // Long-press → native share sheet. No third-party clipboard dep
  // needed; iOS Share is always available and works offline.
  const handleLongPress = async () => {
    try {
      hapticImpactLight();
      await Share.share({
        message: `"${text}" — ${quote.author}\n\nAscend: Monk Mode`,
      });
    } catch {
      // Share dismissed or unavailable — no-op.
    }
  };

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      activeOpacity={0.92}
      delayLongPress={400}
      style={styles.card}
    >
      <Text style={styles.mark}>"</Text>
      <Text style={styles.text} numberOfLines={4}>
        {text}
      </Text>
      <Text style={styles.author}>— {quote.author}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    position: 'relative',
  },
  // Big decorative quote mark, low-contrast — anchor for the eye.
  mark: {
    position: 'absolute',
    top: -4,
    left: 12,
    fontSize: 64,
    color: LT.outlineVariant,
    fontWeight: '900',
    opacity: 0.6,
  },
  text: {
    color: LT.onSurface,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 6,
    paddingHorizontal: 8,
    letterSpacing: -0.2,
  },
  author: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 10,
    paddingHorizontal: 8,
  },
});
