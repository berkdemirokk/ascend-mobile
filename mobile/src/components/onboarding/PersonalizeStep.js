import React from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { LT } from '../../config/lightTheme';

export default function PersonalizeStep({ t, answers, onAnswer }) {
  const goalOptions = [
    { id: 'focus', icon: 'center-focus-strong', labelKey: 'onboarding.goalFocus', fallback: 'Dikkatimi geri almak' },
    { id: 'morning', icon: 'wb-twilight', labelKey: 'onboarding.goalMorning', fallback: 'Sabaha hakim olmak' },
    { id: 'fitness', icon: 'fitness-center', labelKey: 'onboarding.goalFitness', fallback: 'Enerjimi yükseltmek' },
    { id: 'money', icon: 'account-balance-wallet', labelKey: 'onboarding.goalMoney', fallback: 'Paramı yönetmek' },
    { id: 'discipline', icon: 'whatshot', labelKey: 'onboarding.goalGeneral', fallback: 'Başladığımı bitirmek' },
  ];
  const timeOptions = [
    { id: '5', labelKey: 'onboarding.time5', fallback: '5 dk' },
    { id: '15', labelKey: 'onboarding.time15', fallback: '15 dk' },
    { id: '30', labelKey: 'onboarding.time30', fallback: '30+ dk' },
  ];
  const moodOptions = [
    { id: 'motivated', icon: 'whatshot', labelKey: 'onboarding.moodMotivated', fallback: 'Hazırım, başlayalım' },
    { id: 'lost', icon: 'help-outline', labelKey: 'onboarding.moodLost', fallback: 'Dağınığım, yön lazım' },
    { id: 'fresh', icon: 'auto-awesome', labelKey: 'onboarding.moodFresh', fallback: 'Sıfırdan başlıyorum' },
  ];

  return (
    <ScrollView
      style={styles.personalizeScroll}
      contentContainerStyle={styles.personalizeContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.personalizeIntro}>
        {t('onboarding.personalizeIntro', 'Üç kısa cevap ver; ilk görevi sana göre seçelim.')}
      </Text>

      {/* Name — optional */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qName', 'Sana nasıl seslenelim?')}
      </Text>
      <TextInput
        accessibilityLabel={t('onboarding.qName', 'Sana nasıl seslenelim?')}
        value={answers.name || ''}
        onChangeText={(txt) => onAnswer('name', txt.slice(0, 24))}
        placeholder={t('onboarding.namePlaceholder', 'Adın (opsiyonel)')}
        placeholderTextColor={LT.outline}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={24}
        returnKeyType="done"
        style={styles.nameInput}
      />

      {/* Goal */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qGoal', 'Önce neyi düzeltmek istiyorsun?')}
      </Text>
      <View style={styles.optionList}>
        {goalOptions.map((opt) => {
          const active = answers.goal === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, selected: active }}
              accessibilityLabel={t(opt.labelKey, opt.fallback)}
              onPress={() => onAnswer('goal', opt.id)}
              activeOpacity={0.85}
              style={[styles.optionCard, active && styles.optionCardActive]}
            >
              <View style={[styles.optionIconBox, active && styles.optionIconBoxActive]}>
                <MaterialIcons
                  name={opt.icon}
                  size={20}
                  color={active ? LT.onPrimary : LT.onSurfaceVariant}
                />
              </View>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
              {active ? (
                <MaterialIcons name="check-circle" size={18} color={LT.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Time */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qTime', 'Gerçekçi olarak kaç dakikan var?')}
      </Text>
      <View style={styles.optionRow}>
        {timeOptions.map((opt) => {
          const active = answers.time === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, selected: active }}
              accessibilityLabel={t(opt.labelKey, opt.fallback)}
              onPress={() => onAnswer('time', opt.id)}
              activeOpacity={0.85}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mood */}
      <Text style={styles.personalizeQ}>
        {t('onboarding.qMood', 'Bugün hangi noktadasın?')}
      </Text>
      <View style={styles.optionList}>
        {moodOptions.map((opt) => {
          const active = answers.mood === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, selected: active }}
              accessibilityLabel={t(opt.labelKey, opt.fallback)}
              onPress={() => onAnswer('mood', opt.id)}
              activeOpacity={0.85}
              style={[styles.optionCard, active && styles.optionCardActive]}
            >
              <View style={[styles.optionIconBox, active && styles.optionIconBoxActive]}>
                <MaterialIcons
                  name={opt.icon}
                  size={20}
                  color={active ? LT.onPrimary : LT.onSurfaceVariant}
                />
              </View>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {t(opt.labelKey, opt.fallback)}
              </Text>
              {active ? (
                <MaterialIcons name="check-circle" size={18} color={LT.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  personalizeScroll: { flex: 1 },
  personalizeContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  personalizeIntro: {
    fontSize: 14,
    color: LT.onSurfaceVariant,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  personalizeQ: {
    fontSize: 16,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 10,
    marginTop: 14,
    letterSpacing: 0,
  },
  nameInput: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: LT.onSurface,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  optionCardActive: {
    borderColor: LT.primary,
    borderWidth: 2,
    backgroundColor: LT.surfaceContainerLow,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  optionIconBoxActive: {
    backgroundColor: LT.primary,
    borderColor: LT.primary,
  },
  optionLabel: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: LT.primary,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLowest,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: LT.primary,
    borderWidth: 2,
    backgroundColor: LT.surfaceContainerLow,
  },
  chipLabel: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
  },
  chipLabelActive: {
    color: LT.primary,
  },
});
