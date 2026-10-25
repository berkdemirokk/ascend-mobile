import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SettingsSection from './SettingsSection';
import { LT } from '../../config/lightTheme';

export default function PreferencesSection({
  notificationsEnabled,
  toggleNotifications,
  soundsEnabled,
  toggleSounds,
  hapticsEnabled,
  toggleHaptics,
}) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.notifications', 'BİLDİRİMLER (NOTIFICATIONS)')}>
      <View style={[styles.row, styles.rowBorder]}>
        <View style={styles.rowLeft}>
          <View>
            <Text style={styles.rowLabel}>
              {t('settings.dailyReminder', 'Günlük Hatırlatıcılar')}
            </Text>
            <Text style={styles.rowSub}>
              {t(
                'settings.dailyReminderSub',
                'Odaklanma vaktini unutma',
              )}
            </Text>
          </View>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
          trackColor={{ false: LT.outlineVariant, true: LT.primaryContainer }}
          thumbColor={LT.surfaceContainerLowest}
        />
      </View>

      <View style={[styles.row, styles.rowBorder]}>
        <View style={styles.rowLeft}>
          <View>
            <Text style={styles.rowLabel}>
              {t('settings.sounds')}
            </Text>
            <Text style={styles.rowSub}>
              {t('settings.soundsSub')}
            </Text>
          </View>
        </View>
        <Switch
          value={soundsEnabled}
          onValueChange={toggleSounds}
          trackColor={{ false: LT.outlineVariant, true: LT.primaryContainer }}
          thumbColor={LT.surfaceContainerLowest}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View>
            <Text style={styles.rowLabel}>{t('settings.haptics')}</Text>
            <Text style={styles.rowSub}>
              {t('settings.hapticsSub')}
            </Text>
          </View>
        </View>
        <Switch
          value={hapticsEnabled}
          onValueChange={toggleHaptics}
          trackColor={{ false: LT.outlineVariant, true: LT.primaryContainer }}
          thumbColor={LT.surfaceContainerLowest}
        />
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
  rowSub: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
