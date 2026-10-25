import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import SettingsSection from './SettingsSection';
import { LT } from '../../config/lightTheme';

export default function AccountSection({
  user,
  referralCode,
  referralCount,
  inviteStatus,
  inviteDisabled,
  isPremium,
  streakFreezes,
  vacationActive,
  vacationUntil,
  restoring,
  isAuthenticated,
  onInvite,
  onSignIn,
  onRedeemCode,
  onPremiumStatusPress,
  onToggleVacation,
  onRestore,
  onSignOut,
}) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.account', 'HESAP (ACCOUNT)')}>
      <TouchableOpacity
        onPress={onInvite}
        activeOpacity={0.7}
        disabled={inviteDisabled}
        style={[styles.row, styles.rowBorder, inviteDisabled && styles.disabledRow]}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="card-giftcard"
            size={22}
            color={LT.primary}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>
              {t('settings.invite', 'Arkadaşını davet et')}
            </Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {referralCode
                ? t('settings.inviteSubV2', 'Kodun: {{code}}{{tail}}', {
                    code: referralCode,
                    tail:
                      referralCount > 0
                        ? ` · ${t('settings.inviteJoined', { count: referralCount })}`
                        : ` · ${t('settings.inviteReward')}`,
                  })
                : inviteStatus}
            </Text>
          </View>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={18}
          color={LT.onSurfaceVariant}
        />
      </TouchableOpacity>

      {!isAuthenticated && onSignIn ? (
        <TouchableOpacity
          onPress={onSignIn}
          activeOpacity={0.7}
          style={[styles.row, styles.rowBorder]}
        >
          <View style={styles.rowLeft}>
            <MaterialIcons name="login" size={22} color={LT.primary} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{t('settings.signInForReferrals', 'Giriş yap')}</Text>
              <Text style={styles.rowSub}>
                {t('settings.referralSignInHint', 'Davet kodunu kullanmak için hesabına giriş yap.')}
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={LT.onSurfaceVariant} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onRedeemCode}
        activeOpacity={0.7}
        style={[styles.row, styles.rowBorder]}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="redeem"
            size={22}
            color={LT.primary}
          />
          <View>
            <Text style={styles.rowLabel}>
              {t('settings.redeemInvite', 'Davet kodu gir')}
            </Text>
            <Text style={styles.rowSub}>
              {t(
                'settings.redeemInviteSub',
                'Bir arkadaşının kodu varsa, 10 streak donduru kazan',
              )}
            </Text>
          </View>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={18}
          color={LT.onSurfaceVariant}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPremiumStatusPress}
        activeOpacity={0.7}
        style={[styles.row, styles.rowBorder]}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name="workspace-premium"
            size={22}
            color={LT.primaryContainer}
          />
          <Text style={styles.rowLabel}>
            {t('settings.premiumStatus', 'Premium Durumu')}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text
            style={[
              styles.rowValue,
              { color: isPremium ? LT.primaryContainer : LT.onSurfaceVariant },
            ]}
          >
            {isPremium
              ? t('settings.active', 'Aktif')
              : t('settings.inactive', 'Pasif')}
          </Text>
          <MaterialIcons
            name="chevron-right"
            size={18}
            color={LT.onSurfaceVariant}
          />
        </View>
      </TouchableOpacity>

      <View style={[styles.row, styles.rowBorder]}>
        <View style={styles.rowLeft}>
          <MaterialIcons name="ac-unit" size={22} color={LT.primaryContainer} />
          <View>
            <Text style={styles.rowLabel}>
              {t('settings.streakRepair', 'Streak Onarım Jetonu')}
            </Text>
            <Text style={styles.rowSub}>
              {t(
                'settings.streakRepairSub',
                'Bir gün kaçırırsan jeton seriyi otomatik korur',
              )}
            </Text>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowValue, { color: LT.primaryContainer }]}>
            {streakFreezes ?? 0}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onToggleVacation}
        activeOpacity={0.7}
        style={[styles.row, styles.rowBorder]}
      >
        <View style={styles.rowLeft}>
          <MaterialIcons
            name={vacationActive ? 'beach-access' : 'flight-takeoff'}
            size={22}
            color={vacationActive ? LT.primary : LT.onSurfaceVariant}
          />
          <View>
            <Text style={styles.rowLabel}>
              {t('settings.vacation', 'Tatil Modu')}
            </Text>
            <Text style={styles.rowSub}>
              {vacationActive
                ? t('settings.vacationActiveSub', 'Aktif: {{date}}\'e kadar', {
                    date: vacationUntil,
                  })
                : t(
                    'settings.vacationSub',
                    '7 güne kadar streak\'ini koru (Premium)',
                  )}
            </Text>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text
            style={[
              styles.rowValue,
              { color: vacationActive ? LT.primary : LT.onSurfaceVariant },
            ]}
          >
            {vacationActive
              ? t('settings.vacationOn', 'AÇIK')
              : t('settings.vacationOff', 'KAPALI')}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onRestore}
        disabled={restoring}
        activeOpacity={0.7}
        style={[styles.row, isAuthenticated && styles.rowBorder]}
      >
        <View style={styles.rowLeft}>
          {restoring ? (
            <ActivityIndicator size="small" color={LT.primaryContainer} />
          ) : (
            <MaterialIcons
              name="restore"
              size={22}
              color={LT.onSurfaceVariant}
            />
          )}
          <Text style={styles.rowLabel}>
            {restoring
              ? t('settings.restoring', 'Geri yükleniyor...')
              : t('settings.restorePurchases', 'Satın Alımları Geri Yükle')}
          </Text>
        </View>
      </TouchableOpacity>

      {isAuthenticated ? (
        <TouchableOpacity
          onPress={onSignOut}
          activeOpacity={0.7}
          style={styles.row}
        >
          <View style={styles.rowLeft}>
            <MaterialIcons name="logout" size={22} color={LT.onSurfaceVariant} />
            <Text style={styles.rowLabel}>
              {t('settings.logout', 'Çıkış Yap')}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  rowValue: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '600',
  },
  rowText: {
    flex: 1,
    flexShrink: 1,
  },
  disabledRow: {
    opacity: 0.6,
  },
});
