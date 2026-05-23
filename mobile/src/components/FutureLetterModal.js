// Letter from Your Future Self — rare modal surfaced after a small
// percentage of lesson completions. The variable-reward research
// (Skinner, then Eyal in Hooked) shows that the strongest engagement
// loops aren't built on consistent rewards or even random AMOUNT —
// they're built on random REWARD TYPE. The Mystery Box covers the
// "random amount" axis (XP, freeze, bonus). This modal covers the
// "occasional fundamentally different reward" axis: an identity
// moment, not a utility moment.
//
// Designed to feel hand-written, NOT app-generated:
//   - No icon row, no progress bar, no "you earned X" badge
//   - Quiet, monospace-adjacent typography
//   - Single dismiss CTA, no choice paralysis
//   - One swipe / one tap and it's gone

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LT } from '../config/lightTheme';
import { useTranslation } from 'react-i18next';

export default function FutureLetterModal({ visible, letter, onClose }) {
  const { t } = useTranslation();
  if (!letter) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Small unobtrusive label so the user knows what this is —
              not a celebration banner, just a quiet "this came from
              somewhere meaningful". */}
          <Text style={styles.label}>
            {t('futureLetter.label', 'KENDİNDEN BİR MEKTUP')}
          </Text>
          <Text style={styles.title}>{letter.title}</Text>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.body}>{letter.body}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.cta}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>
              {t('futureLetter.cta', 'OKUDUM')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: LT.background,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '78%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: LT.onSurface,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  bodyScroll: {
    maxHeight: 320,
    marginBottom: 20,
  },
  bodyContent: {
    paddingHorizontal: 4,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 24,
    // Slightly looser than body copy elsewhere; the letter is meant to
    // be read slowly, not skimmed like a paragraph in a feature card.
  },
  cta: {
    backgroundColor: LT.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
});
