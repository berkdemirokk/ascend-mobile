import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW, LT_SPACING } from '../../config/lightTheme';

export function QuizPhase({
  currentQuestion,
  quizIndex,
  quizLength,
  selectedAnswer,
  revealed,
  handleSelectAnswer,
  teachingPages = [],
  proTip = null,
}) {
  const { t } = useTranslation();
  if (!currentQuestion) return null;

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stepChip}>
        <Text style={styles.stepChipText}>
          {t('lesson.quiz', 'QUIZ')} — {quizIndex + 1}/{quizLength}
        </Text>
      </View>
      <Text style={[styles.title, { marginTop: 16 }]}>{currentQuestion.q}</Text>
      <Text style={styles.questionSubtitle}>
        {t('lesson.quizHint', 'Doğru olduğunu düşündüğün cevabı seç.')}
      </Text>

      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((opt, idx) => {
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === currentQuestion.correct;
          const showCorrect = revealed && isCorrect;
          const showWrong = revealed && isSelected && !isCorrect;

          const cardStyle = [styles.optionCard];
          const letterBoxStyle = [styles.optionLetterBox];
          let letterColor = LT.onSurfaceVariant;

          if (showCorrect) {
            cardStyle.push({
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              borderColor: '#10B981',
            });
            letterBoxStyle.push({ backgroundColor: '#10B981', borderColor: '#10B981' });
            letterColor = '#FFFFFF';
          } else if (showWrong) {
            cardStyle.push({
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              borderColor: '#EF4444',
            });
            letterBoxStyle.push({ backgroundColor: '#EF4444', borderColor: '#EF4444' });
            letterColor = '#FFFFFF';
          } else if (isSelected) {
            cardStyle.push(styles.optionCardSelected);
            letterBoxStyle.push(styles.optionLetterBoxSelected);
            letterColor = LT.onPrimary;
          }

          return (
            <TouchableOpacity
              key={idx}
              style={cardStyle}
              onPress={() => handleSelectAnswer(idx)}
              activeOpacity={0.85}
              disabled={revealed}
            >
              <View style={letterBoxStyle}>
                <Text style={[styles.optionLetter, { color: letterColor }]}>
                  {letters[idx]}
                </Text>
              </View>
              <Text
                style={[
                  styles.optionText,
                  showCorrect && { color: '#047857', fontWeight: '700' },
                  showWrong && { color: '#B91C1C', fontWeight: '700' },
                ]}
              >
                {opt}
              </Text>
              {showCorrect && (
                <MaterialIcons name="check-circle" size={22} color="#10B981" />
              )}
              {showWrong && (
                <MaterialIcons name="cancel" size={22} color="#EF4444" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {revealed && currentQuestion.explain && (
        <View
          style={[
            styles.explainBox,
            selectedAnswer === currentQuestion.correct
              ? styles.explainBoxCorrect
              : styles.explainBoxLearn,
          ]}
        >
          <View style={styles.explainHeader}>
            <MaterialIcons
              name={
                selectedAnswer === currentQuestion.correct
                  ? 'check-circle'
                  : 'lightbulb'
              }
              size={18}
              color={
                selectedAnswer === currentQuestion.correct
                  ? '#10B981'
                  : LT.primaryContainer
              }
            />
            <Text
              style={[
                styles.explainLabel,
                selectedAnswer === currentQuestion.correct
                  ? styles.explainLabelCorrect
                  : styles.explainLabelLearn,
              ]}
            >
              {selectedAnswer === currentQuestion.correct
                ? t('lesson.explainCorrect', 'NEDEN DOĞRU')
                : t('lesson.explainWrong', 'AÇIKLAMA')}
            </Text>
          </View>
          <Text style={styles.explainText}>{currentQuestion.explain}</Text>

          {teachingPages[1] ? (
            <View style={styles.quizDepthSection}>
              <Text style={styles.quizDepthHeader}>
                {t('lesson.depthContext', 'KONUYA BAĞLAM')}
              </Text>
              <Text style={styles.quizDepthBody}>
                {(() => {
                  const sci = teachingPages[1] || '';
                  const firstSentence = sci
                    .split(/(?<=[.!?])\s+/)
                    .filter((s) => s.length > 20)[0];
                  return firstSentence || sci.slice(0, 200);
                })()}
              </Text>
            </View>
          ) : null}

          {proTip ? (
            <View style={styles.quizDepthSection}>
              <Text style={styles.quizDepthHeader}>
                {t('lesson.depthApply', 'NASIL UYGULA')}
              </Text>
              <Text style={styles.quizDepthBody}>{proTip}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 16,
    paddingBottom: 40,
  },
  stepChip: {
    alignSelf: 'flex-start',
    backgroundColor: LT.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: LT_RADII.pill,
  },
  stepChipText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.onSurfaceVariant,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: LT.onSurface,
    lineHeight: 28,
  },
  questionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    marginTop: 6,
    marginBottom: 18,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    ...LT_SHADOW.ambient,
  },
  optionCardSelected: {
    borderColor: LT.primaryContainer,
    backgroundColor: LT.surfaceContainerLowest,
  },
  optionLetterBox: {
    width: 32,
    height: 32,
    borderRadius: LT_RADII.sm,
    backgroundColor: LT.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionLetterBoxSelected: {
    backgroundColor: LT.primaryContainer,
  },
  optionLetter: {
    fontSize: 14,
    fontWeight: '900',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: LT.onSurface,
    lineHeight: 20,
  },
  explainBox: {
    marginTop: 18,
    borderRadius: LT_RADII.lg,
    padding: 14,
    borderWidth: 1.5,
  },
  explainBoxCorrect: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  explainBoxLearn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  explainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  explainLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  explainLabelCorrect: {
    color: '#047857',
  },
  explainLabelLearn: {
    color: LT.primaryContainer,
  },
  explainText: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 18,
  },
  quizDepthSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  quizDepthHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: LT.onSurfaceVariant,
    marginBottom: 4,
  },
  quizDepthBody: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 18,
  },
});
