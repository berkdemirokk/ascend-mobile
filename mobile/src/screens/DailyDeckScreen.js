// DailyDeckScreen — "kısa kısa çok sayfa" engagement format the user
// asked for after the long-form Deep Dive idea was rejected. A deck
// of 6 micro-cards, each 20-30 seconds, total 3-4 minutes. Feels
// FAST because each card is a fresh tap; feels SUBSTANTIVE because
// at the end the user has read a real quote, considered it,
// answered a short question, and committed to a micro-action.
//
// Structure (mirrors a Stoic morning ritual but bite-sized):
//   Card 1: The quote (large type, single line)
//   Card 2: Who said it + context (~25 words)
//   Card 3: How it applies today (~30 words)
//   Card 4: Mini-question (one-line response, 80 char cap)
//   Card 5: Mini-action (single ✓ commitment)
//   Card 6: Done + share
//
// No back button between cards — by design. Going back would make
// it feel like a form. We want it to feel like turning pages of a
// pocket book. Skip arrow in the top right lets the user bail.
//
// On Card 6 we save the response to pathPledges (re-using the
// existing pledge storage as a journal-of-sorts) so the reflection
// archive grows daily even when the user doesn't write long
// reflections inside lessons.

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  Easing,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { LT } from '../config/lightTheme';
import { useApp } from '../contexts/AppContext';
import { getTodaysDeck } from '../data/dailyDecks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_CARDS = 6;

export default function DailyDeckScreen({ navigation }) {
  const { t } = useTranslation();
  const { recordDailyDeckCompleted } = useApp();
  const deck = getTodaysDeck();

  const [cardIdx, setCardIdx] = useState(0);
  const [response, setResponse] = useState('');
  const [actionCommitted, setActionCommitted] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  if (!deck) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.placeholderText}>
            {t('dailyDeck.empty', 'Bugünün destesi yüklenemedi.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const advance = () => {
    // Fade out current card, swap index, fade back in. 220 ms is
    // fast enough to feel snappy but slow enough that the eye
    // registers a transition (vs. just popping).
    Animated.timing(fade, {
      toValue: 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCardIdx((i) => Math.min(i + 1, TOTAL_CARDS - 1));
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const finishDeck = () => {
    try {
      recordDailyDeckCompleted({
        deckId: deck.id,
        response: response.trim(),
        actionCommitted,
      });
    } catch {}
    navigation.goBack();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t(
          'dailyDeck.shareMsg',
          '"{{quote}}" — {{author}}. Bugünün destesinden. Ascend: Monk Mode.',
          { quote: deck.quote, author: deck.author },
        ),
      });
    } catch {}
  };

  // Progress dots at the top — 6 dots, current one filled. Visual
  // reassurance that the deck is finite ("ben kaç kart kaldı")
  // which is the #1 anxiety in any multi-step UX.
  const progressDots = (
    <View style={styles.dotsRow}>
      {Array.from({ length: TOTAL_CARDS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i <= cardIdx && styles.dotActive,
            i === cardIdx && styles.dotCurrent,
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          {progressDots}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="close" size={22} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Card surface */}
        <Animated.View style={[styles.cardWrap, { opacity: fade }]}>
          {cardIdx === 0 && <QuoteCard quote={deck.quote} />}
          {cardIdx === 1 && (
            <ContextCard author={deck.author} meta={deck.authorMeta} context={deck.context} t={t} />
          )}
          {cardIdx === 2 && (
            <ApplicationCard application={deck.application} t={t} />
          )}
          {cardIdx === 3 && (
            <QuestionCard
              question={deck.microQuestion}
              response={response}
              setResponse={setResponse}
              t={t}
            />
          )}
          {cardIdx === 4 && (
            <ActionCard
              action={deck.microAction}
              committed={actionCommitted}
              onCommit={() => setActionCommitted(true)}
              t={t}
            />
          )}
          {cardIdx === 5 && (
            <DoneCard
              onShare={handleShare}
              onFinish={finishDeck}
              t={t}
            />
          )}
        </Animated.View>

        {/* Bottom primary CTA — same shape on every card, label
            changes per step. Predictable position = fast tapping. */}
        {cardIdx < TOTAL_CARDS - 1 ? (
          <TouchableOpacity
            style={styles.advanceBtn}
            onPress={advance}
            activeOpacity={0.85}
          >
            <Text style={styles.advanceBtnText}>
              {cardIdx === 3
                ? response.trim().length >= 3
                  ? t('dailyDeck.next', 'Sonraki')
                  : t('dailyDeck.skipResponse', 'Boş geç')
                : cardIdx === 4
                  ? actionCommitted
                    ? t('dailyDeck.next', 'Sonraki')
                    : t('dailyDeck.skipAction', 'Şimdilik geç')
                  : t('dailyDeck.next', 'Sonraki')}
            </Text>
            <MaterialIcons
              name="arrow-forward"
              size={18}
              color={LT.onPrimary}
            />
          </TouchableOpacity>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Per-card components — kept inline so the deck is one file ──

function QuoteCard({ quote }) {
  return (
    <View style={styles.cardContent}>
      <Text style={styles.quoteOpen}>"</Text>
      <Text style={styles.quoteText}>{quote}</Text>
    </View>
  );
}

function ContextCard({ author, meta, context, t }) {
  return (
    <View style={styles.cardContent}>
      <Text style={styles.eyebrow}>{t('dailyDeck.whoSaid', 'KİM SÖYLEDİ')}</Text>
      <Text style={styles.author}>{author}</Text>
      <Text style={styles.authorMeta}>{meta}</Text>
      <Text style={styles.contextText}>{context}</Text>
    </View>
  );
}

function ApplicationCard({ application, t }) {
  return (
    <View style={styles.cardContent}>
      <Text style={styles.eyebrow}>
        {t('dailyDeck.howToApply', 'NASIL UYGULANIR')}
      </Text>
      <Text style={styles.applicationText}>{application}</Text>
    </View>
  );
}

function QuestionCard({ question, response, setResponse, t }) {
  return (
    <View style={styles.cardContent}>
      <Text style={styles.eyebrow}>{t('dailyDeck.youSay', 'SEN NE DİYORSUN')}</Text>
      <Text style={styles.questionText}>{question}</Text>
      <TextInput
        style={styles.responseInput}
        value={response}
        onChangeText={(v) => setResponse(v.slice(0, 80))}
        placeholder={t('dailyDeck.responsePlaceholder', 'Tek satır cevap...')}
        placeholderTextColor={LT.onSurfaceVariant}
        autoFocus
        maxLength={80}
      />
      <Text style={styles.counter}>{response.length}/80</Text>
    </View>
  );
}

function ActionCard({ action, committed, onCommit, t }) {
  return (
    <View style={styles.cardContent}>
      <Text style={styles.eyebrow}>{t('dailyDeck.miniAction', 'MİKRO EYLEM')}</Text>
      <Text style={styles.actionText}>{action}</Text>
      <TouchableOpacity
        onPress={onCommit}
        style={[styles.commitBtn, committed && styles.commitBtnDone]}
        activeOpacity={0.85}
        disabled={committed}
      >
        <MaterialIcons
          name={committed ? 'check-circle' : 'check-circle-outline'}
          size={20}
          color={committed ? LT.onPrimary : LT.primary}
        />
        <Text
          style={[
            styles.commitBtnText,
            committed && { color: LT.onPrimary },
          ]}
        >
          {committed
            ? t('dailyDeck.commitDone', 'TAAHHÜT VERDİM')
            : t('dailyDeck.commit', 'BUGÜN YAPACAĞIM')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function DoneCard({ onShare, onFinish, t }) {
  return (
    <View style={styles.cardContent}>
      <View style={styles.doneIcon}>
        <MaterialIcons name="check-circle" size={56} color={LT.primary} />
      </View>
      <Text style={styles.doneTitle}>
        {t('dailyDeck.doneTitle', 'Destesi tamamladın.')}
      </Text>
      <Text style={styles.doneBody}>
        {t(
          'dailyDeck.doneBody',
          'Bugün 3 dakika derin bir an yaşadın. Yarın yeni deste.',
        )}
      </Text>
      <TouchableOpacity
        onPress={onShare}
        style={styles.shareSecondary}
        activeOpacity={0.85}
      >
        <MaterialIcons name="ios-share" size={16} color={LT.primary} />
        <Text style={styles.shareSecondaryText}>
          {t('dailyDeck.shareQuote', 'Alıntıyı paylaş')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onFinish}
        style={styles.advanceBtn}
        activeOpacity={0.85}
      >
        <Text style={styles.advanceBtnText}>
          {t('dailyDeck.finish', 'Tamamla')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  placeholderText: {
    fontSize: 14,
    color: LT.onSurfaceVariant,
    textAlign: 'center',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dotsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: LT.surfaceContainer,
  },
  dotActive: {
    backgroundColor: LT.primary,
    opacity: 0.5,
  },
  dotCurrent: {
    opacity: 1,
  },

  cardWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },

  // Quote card — big type, single anchor
  quoteOpen: {
    fontSize: 72,
    color: LT.outline,
    fontWeight: '900',
    lineHeight: 56,
    marginBottom: -8,
  },
  quoteText: {
    fontSize: 26,
    fontWeight: '700',
    color: LT.onSurface,
    lineHeight: 34,
  },

  // Context card
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.primary,
    marginBottom: 12,
  },
  author: {
    fontSize: 22,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 4,
  },
  authorMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    marginBottom: 20,
  },
  contextText: {
    fontSize: 16,
    color: LT.onSurface,
    lineHeight: 24,
  },

  applicationText: {
    fontSize: 16,
    color: LT.onSurface,
    lineHeight: 24,
  },

  // Question card
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: LT.onSurface,
    lineHeight: 24,
    marginBottom: 24,
  },
  responseInput: {
    fontSize: 16,
    color: LT.onSurface,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 14,
    padding: 14,
    minHeight: 56,
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: LT.onSurfaceVariant,
    marginTop: 6,
  },

  // Action card
  actionText: {
    fontSize: 18,
    fontWeight: '700',
    color: LT.onSurface,
    lineHeight: 26,
    marginBottom: 28,
  },
  commitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: LT.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  commitBtnDone: {
    backgroundColor: LT.primary,
    borderColor: LT.primary,
  },
  commitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.primary,
  },

  // Done card
  doneIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: LT.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  doneBody: {
    fontSize: 14,
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  shareSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  shareSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: LT.primary,
  },

  // Bottom CTA (shared across all non-final cards)
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    marginTop: 12,
  },
  advanceBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
});
