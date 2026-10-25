import React from 'react';
import { View, Text, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import SettingsSection from './SettingsSection';
import { LEGAL } from '../../config/constants';
import { LT } from '../../config/lightTheme';

export default function LegalSection({ version, buildNumber }) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.legal', 'YASAL (LEGAL)')}>
      <TouchableOpacity
        onPress={() => Linking.openURL(LEGAL.PRIVACY_URL)}
        activeOpacity={0.7}
        style={[styles.row, styles.rowBorder]}
      >
        <Text style={styles.rowLabel}>
          {t('settings.privacyPolicy', 'Gizlilik Politikası')}
        </Text>
        <MaterialIcons name="open-in-new" size={18} color={LT.onSurfaceVariant} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => Linking.openURL(LEGAL.TERMS_URL)}
        activeOpacity={0.7}
        style={[styles.row, styles.rowBorder]}
      >
        <Text style={styles.rowLabel}>
          {t('settings.termsOfService', 'Kullanım Koşulları')}
        </Text>
        <MaterialIcons name="open-in-new" size={18} color={LT.onSurfaceVariant} />
      </TouchableOpacity>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>
          {t('settings.version', 'Versiyon')}
        </Text>
        <Text style={[styles.rowValue, styles.versionText]}>
          {version} ({t('settings.build', 'Derleme')} {buildNumber})
        </Text>
      </View>
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
  rowLabel: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '600',
  },
  versionText: {
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },
});
