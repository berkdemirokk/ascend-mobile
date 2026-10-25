import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW, LT_SPACING } from '../../config/lightTheme';

export function TeachingPhase({
  teachingPages = [],
  teachingPageIdx = 0,
  teaching = '',
  title = '',
  proTip = null,
  handleTeachingBack,
  isSpeaking = false,
  handleToggleSpeak,
}) {
  const { t } = useTranslation();

  const pageLabels = [
    `📖 ${t('lesson.teachingPage0', 'SAHNE')}`,
    `🔬 ${t('lesson.teachingPage1', 'BİLİM')}`,
    `⚙️ ${t('lesson.teachingPage2', 'MEKANİZMA')}`,
    `🎯 ${t('lesson.teachingPage3', 'PRATİK')}`,
  ];
  const totalPages = Math.max(teachingPages.length, 1);
  const pageLabel =
    teachingPages.length >= 3
      ? pageLabels[teachingPageIdx] || `📖 ${t('lesson.teaching', 'ÖĞRETİM')}`
      : `📖 ${t('lesson.teaching', 'ÖĞRETİM')}`;
  const currentParagraph =
    teachingPages[teachingPageIdx] || teaching || '';
  const isLastTeachingPage = teachingPageIdx >= totalPages - 1;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Per-page step label */}
      <View style={styles.teachingPageHeader}>
        <Text style={styles.stepLabel}>{pageLabel}</Text>
        {totalPages > 1 ? (
          <Text style={styles.teachingPageCount}>
            {teachingPageIdx + 1}/{totalPages}
          </Text>
        ) : null}
      </View>

      {/* Title only on the first page */}
      {teachingPageIdx === 0 ? <Text style={styles.title}>{title}</Text> : null}

      {/* Progress bar across pages */}
      {totalPages > 1 ? (
        <View style={styles.teachingProgressTrack}>
          <View
            style={[
              styles.teachingProgressFill,
              {
                width: `${((teachingPageIdx + 1) / totalPages) * 100}%`,
              },
            ]}
          />
        </View>
      ) : null}

      {/* Hero Mascot on page 0 */}
      {teachingPageIdx === 0 ? (
        <View style={styles.heroBox}>
          <View style={styles.heroMascot}>
            <MaterialIcons
              name="self-improvement"
              size={68}
              color={LT.primaryContainer}
            />
          </View>
        </View>
      ) : null}

      {/* Paragraph card */}
      <View style={styles.teachingCard}>
        <View style={styles.cornerAccent} />
        <TouchableOpacity
          onPress={handleToggleSpeak}
          activeOpacity={0.85}
          style={styles.speakBtn}
          accessibilityLabel={
            isSpeaking
              ? t('lesson.stopAudio', 'Sesi durdur')
              : t('lesson.playAudio', 'Sesli oku')
          }
        >
          <MaterialIcons
            name={isSpeaking ? 'stop' : 'volume-up'}
            size={18}
            color={LT.onPrimary}
          />
          <Text style={styles.speakBtnText}>
            {isSpeaking
              ? t('lesson.stopAudio', 'Durdur')
              : t('lesson.playAudio', 'Sesli dinle')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.teachingText}>{currentParagraph}</Text>
      </View>

      {/* ProTip — only on last page */}
      {proTip && isLastTeachingPage ? (
        <View style={styles.proTipBox}>
          <MaterialIcons name="lightbulb" size={22} color="#FDE047" />
          <View style={{ flex: 1 }}>
            <Text style={styles.proTipLabel}>{t('lesson.proTip', 'PRO İPUCU')}</Text>
            <Text style={styles.proTipBody}>{proTip}</Text>
          </View>
        </View>
      ) : null}

      {/* Back link */}
      {teachingPageIdx > 0 ? (
        <TouchableOpacity
          onPress={handleTeachingBack}
          style={styles.teachingBackLink}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="arrow-back"
            size={16}
            color={LT.onSurfaceVariant}
          />
          <Text style={styles.teachingBackText}>
            {t('lesson.previousPage', 'Önceki sayfa')}
          </Text>
        </TouchableOpacity>
      ) : null}

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
  teachingPageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.primary,
  },
  teachingPageCount: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.onSurfaceVariant,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: LT.onSurface,
    lineHeight: 30,
    marginBottom: 14,
  },
  teachingProgressTrack: {
    height: 4,
    backgroundColor: LT.surfaceContainerHigh,
    borderRadius: LT_RADII.pill,
    marginBottom: 16,
    overflow: 'hidden',
  },
  teachingProgressFill: {
    height: '100%',
    backgroundColor: LT.primary,
  },
  heroBox: {
    alignItems: 'center',
    marginVertical: 12,
  },
  heroMascot: {
    width: 90,
    height: 90,
    borderRadius: LT_RADII.pill,
    backgroundColor: LT.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teachingCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    ...LT_SHADOW.ambient,
    position: 'relative',
  },
  cornerAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 32,
    height: 32,
    borderTopLeftRadius: LT_RADII.xl,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: LT.primaryContainer,
  },
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LT.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: LT_RADII.pill,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  speakBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: LT.onPrimary,
  },
  teachingText: {
    fontSize: 16,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 24,
  },
  proTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(253, 224, 71, 0.12)',
    borderRadius: LT_RADII.lg,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.4)',
  },
  proTipLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#854D0E',
    marginBottom: 4,
  },
  proTipBody: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 18,
  },
  teachingBackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  teachingBackText: {
    fontSize: 13,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
  },
});
