import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import SettingsSection from './SettingsSection';
import { LT } from '../../config/lightTheme';

export default function DangerZoneSection({
  onResetProgress,
  onDeleteAccount,
}) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.dangerZone', 'TEHLİKELİ BÖLGE (DANGER ZONE)')}>
      <TouchableOpacity
        onPress={onResetProgress}
        activeOpacity={0.7}
        style={[styles.row, styles.rowBorder, styles.dangerRow]}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="refresh"
            size={22}
            color={LT.onPrimary}
          />
          <Text style={[styles.rowLabel, styles.dangerLabel]}>
            {t('settings.resetProgress', 'İlerlemeyi Sıfırla')}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDeleteAccount}
        activeOpacity={0.7}
        style={styles.row}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="delete-forever"
            size={22}
            color={LT.error}
          />
          <Text style={[styles.rowLabel, { color: LT.error }]}>
            {t('settings.deleteAccount', 'Hesabı Sil')}
          </Text>
        </View>
      </TouchableOpacity>
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
  dangerRow: {
    backgroundColor: '#EF4444',
  },
  dangerLabel: {
    color: LT.onPrimary,
    fontWeight: '700',
  },
});
