import { View, Text, ScrollView, TextInput, StyleSheet, Image } from 'react-native';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADII, LT_SHADOW, LT_SPACING } from '../../config/lightTheme';

const REFLECTION_MAX = 250;

export function CommitPhase({
  action = '',
  actionDone = false,
  setActionDone,
  alreadyCompleted = false,
  reflectionPrompt = null,
  reflection = '',
  setReflection,
  handleToggleRecord,
  recording = false,
  recordingUri = null,
  handlePlayRecording,
}) {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stepChipTertiary}>
        <Text style={styles.stepChipTertiaryText}>
          {t('lesson.action', 'BUGÜN YAP')}
        </Text>
      </View>

      <View style={styles.commitMascotWrap}>
        <LinearGradient
          colors={[LT.surfaceContainerLowest, LT.surfaceContainerLowest]}
          style={styles.commitMascotCircle}
        >
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.commitMascotImg}
            resizeMode="contain"
          />
        </LinearGradient>
      </View>

      <TouchableOpacity
        style={[
          styles.actionCard,
          (actionDone || alreadyCompleted) && styles.actionCardActive,
        ]}
        onPress={() => !alreadyCompleted && setActionDone(!actionDone)}
        activeOpacity={alreadyCompleted ? 1 : 0.8}
      >
        <View
          style={[
            styles.checkbox,
            (actionDone || alreadyCompleted) && styles.checkboxActive,
          ]}
        >
          {(actionDone || alreadyCompleted) && (
            <MaterialIcons name="check" size={18} color={LT.onPrimary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionText}>{action}</Text>
          {!alreadyCompleted && !actionDone && (
            <Text style={styles.actionHint}>
              {t('lesson.tapToCheck', 'YAPTIĞINDA İŞARETLE')}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {reflectionPrompt ? (
        <View style={styles.reflectionWrap}>
          <Text style={styles.reflectionLabel}>{reflectionPrompt}</Text>
          <View style={styles.reflectionBox}>
            <TextInput
              value={reflection}
              onChangeText={(txt) => setReflection(txt.slice(0, REFLECTION_MAX))}
              placeholder={t('lesson.reflectionPlaceholder', 'Düşüncelerini buraya yaz...')}
              placeholderTextColor={LT.outline}
              multiline
              style={styles.reflectionInput}
              editable={!alreadyCompleted}
            />
            <View style={styles.reflectionEditIcon} pointerEvents="none">
              <MaterialIcons name="edit-note" size={20} color={LT.outline} />
            </View>
          </View>
          <View style={styles.reflectionMeta}>
            <Text style={styles.reflectionMetaText}>
              {t('lesson.optional', 'OPSİYONEL')}
            </Text>
            <Text style={styles.reflectionMetaText}>
              {reflection.length} / {REFLECTION_MAX}
            </Text>
          </View>

          {/* Voice journal */}
          <View style={styles.voiceRow}>
            <TouchableOpacity
              onPress={handleToggleRecord}
              activeOpacity={0.85}
              style={[styles.voiceBtn, recording && styles.voiceBtnRecording]}
              disabled={alreadyCompleted}
            >
              <MaterialIcons
                name={recording ? 'stop-circle' : 'mic'}
                size={18}
                color={recording ? LT.onPrimary : LT.primary}
              />
              <Text
                style={[
                  styles.voiceBtnText,
                  recording && styles.voiceBtnTextRecording,
                ]}
              >
                {recording
                  ? t('lesson.voiceStop', 'KAYDI DURDUR')
                  : recordingUri
                  ? t('lesson.voiceReRecord', 'YENİDEN KAYDET')
                  : t('lesson.voiceRecord', 'SESLİ KAYIT')}
              </Text>
            </TouchableOpacity>
            {recordingUri && !recording ? (
              <TouchableOpacity
                onPress={handlePlayRecording}
                activeOpacity={0.85}
                style={styles.voicePlayBtn}
              >
                <MaterialIcons name="play-circle-fill" size={20} color={LT.primary} />
                <Text style={styles.voicePlayText}>
                  {t('lesson.voicePlay', 'DİNLE')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ height: 160 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 16,
    paddingBottom: 40,
  },
  stepChipTertiary: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(55, 65, 225, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: LT_RADII.pill,
    marginBottom: 16,
  },
  stepChipTertiaryText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: LT.tertiary,
  },
  commitMascotWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  commitMascotCircle: {
    width: 76,
    height: 76,
    borderRadius: LT_RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    ...LT_SHADOW.ambient,
  },
  commitMascotImg: {
    width: 48,
    height: 48,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.xl,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    gap: 14,
    ...LT_SHADOW.ambient,
  },
  actionCardActive: {
    borderColor: LT.primary,
    backgroundColor: LT.surfaceContainerLowest,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: LT_RADII.sm,
    borderWidth: 2,
    borderColor: LT.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: LT.primary,
    borderColor: LT.primary,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
    color: LT.onSurface,
    lineHeight: 22,
  },
  actionHint: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: LT.onSurfaceVariant,
    marginTop: 4,
  },
  reflectionWrap: {
    marginTop: 4,
  },
  reflectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: LT.onSurface,
    marginBottom: 10,
    lineHeight: 20,
  },
  reflectionBox: {
    position: 'relative',
  },
  reflectionInput: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADII.lg,
    padding: 14,
    paddingRight: 40,
    fontSize: 14,
    fontWeight: '500',
    color: LT.onSurface,
    minHeight: 90,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  reflectionEditIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  reflectionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  reflectionMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LT.surfaceContainerHigh,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: LT_RADII.pill,
  },
  voiceBtnRecording: {
    backgroundColor: '#EF4444',
  },
  voiceBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: LT.primary,
  },
  voiceBtnTextRecording: {
    color: LT.onPrimary,
  },
  voicePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LT.surfaceContainerHigh,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: LT_RADII.pill,
  },
  voicePlayText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: LT.primary,
  },
});
