import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import SettingsSection from './SettingsSection';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { LT } from '../../config/lightTheme';

export default function LanguageSection({ currentLang, onChangeLanguage }) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.language', 'DİL (LANGUAGE)')}>
      {SUPPORTED_LANGUAGES.map((l, idx, arr) => {
        const isLast = idx === arr.length - 1;
        const active = currentLang === l.code;
        return (
          <TouchableOpacity
            key={l.code}
            onPress={() => onChangeLanguage(l.code)}
            activeOpacity={0.7}
            style={[styles.row, !isLast && styles.rowBorder]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={l.label}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.flag}>{l.flag}</Text>
              <Text style={styles.rowLabel}>{l.label}</Text>
            </View>
            <View
              style={[
                styles.radio,
                active && styles.radioActive,
              ]}
            >
              {active && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '600',
  },
  flag: {
    fontSize: 22,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: LT.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: LT.primaryContainer,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: LT.primaryContainer,
  },
});
