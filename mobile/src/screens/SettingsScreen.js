import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  StatusBar,
  Share,
} from 'react-native';
import {
  AccessibleTouchableOpacity as TouchableOpacity,
} from '../components/AccessibleControls';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { LEGAL } from '../config/constants';
import { LT, LT_RADIUS } from '../config/lightTheme';
import { setLanguage, getCurrentLanguage } from '../i18n';
import {
  DAILY_REMINDER_ENABLED_KEY,
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelAllNotifications,
} from '../services/notifications';
import { restorePurchases } from '../services/purchases';
import {
  ensureMyReferral,
  redeemReferralCode,
  getReferralStats,
  PENDING_REFERRAL_CODE_KEY,
  isReferralCodeFormatValid,
} from '../services/referral';
import { setMuted } from '../services/sounds';
import {
  getHapticsEnabled,
  setHapticsEnabled as persistHapticsEnabled,
  initHaptics,
  hapticImpactLight,
} from '../services/haptics';
import AdDebugModal from '../components/AdDebugModal';

// Modularized settings subcomponents
import LanguageSection from '../components/settings/LanguageSection';
import PreferencesSection from '../components/settings/PreferencesSection';
import AccountSection from '../components/settings/AccountSection';
import DangerZoneSection from '../components/settings/DangerZoneSection';
import LegalSection from '../components/settings/LegalSection';
import RedeemCodeModal from '../components/settings/RedeemCodeModal';
import SettingsSection from '../components/settings/SettingsSection';

const SOUNDS_MUTED_KEY = '@ascend/sounds_muted_v1';

export default function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    isPremium,
    deleteAccount,
    setPremium,
    resetProgress,
    streakFreezes,
    currentStreak,
    activePathId,
    vacationUntil,
    startVacation,
    endVacation,
    grantReferralReward,
  } = useApp();
  const { user, isAuthenticated, signOut, leaveGuestMode } = useAuth();

  const vacationActive = (() => {
    if (!vacationUntil) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return vacationUntil >= todayStr;
  })();

  const [referralCount, setReferralCount] = useState(0);
  const [myReferralCode, setMyReferralCode] = useState(null);
  const [referralCodeUserId, setReferralCodeUserId] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralLoadFailed, setReferralLoadFailed] = useState(false);
  const activeReferralUserIdRef = useRef(null);
  activeReferralUserIdRef.current = isAuthenticated ? user?.id || null : null;
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [restoring, setRestoring] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const [adDebugOpen, setAdDebugOpen] = useState(false);
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    const requestedUserId = isAuthenticated ? user?.id : null;
    setReferralCount(0);
    setMyReferralCode(null);
    setReferralCodeUserId(null);
    setReferralLoadFailed(false);
    if (!requestedUserId) {
      setReferralLoading(false);
      return undefined;
    }
    let cancelled = false;
    setReferralLoading(true);
    Promise.all([ensureMyReferral(requestedUserId), getReferralStats(requestedUserId)])
      .then(([code, stats]) => {
        if (cancelled || activeReferralUserIdRef.current !== requestedUserId) return;
        setMyReferralCode(code);
        setReferralCodeUserId(code ? requestedUserId : null);
        setReferralCount(stats?.redemptions || 0);
        setReferralLoadFailed(!code);
      })
      .catch(() => {
        if (cancelled) return;
        setReferralLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, isAuthenticated]);

  useEffect(() => {
    AsyncStorage.getItem(SOUNDS_MUTED_KEY).then((v) => {
      setSoundsEnabled(v !== 'true');
    });
    initHaptics().then(() => setHapticsEnabledState(getHapticsEnabled()));
    AsyncStorage.getItem(DAILY_REMINDER_ENABLED_KEY).then((v) => {
      setNotificationsEnabled(v === 'true');
    });
  }, []);

  const handleInvite = async () => {
    if (!isAuthenticated || !user?.id) return;
    let code = referralCodeUserId === user.id ? myReferralCode : null;
    if (!code) {
      setReferralLoading(true);
      setReferralLoadFailed(false);
      try {
        code = await ensureMyReferral(user.id);
        if (activeReferralUserIdRef.current !== user.id) return;
        if (!code) throw new Error('Referral code is unavailable');
        setMyReferralCode(code);
        setReferralCodeUserId(user.id);
      } catch {
        setReferralLoadFailed(true);
        Alert.alert(
          t('settings.redeemErrorTitle', 'Hata'),
          t('settings.referralCodeUnavailable', 'Davet kodun alınamadı. İnternetini kontrol edip tekrar dene.'),
        );
        return;
      } finally {
        if (activeReferralUserIdRef.current === user.id) setReferralLoading(false);
      }
    }
    if (activeReferralUserIdRef.current !== user.id) return;
    const link = `${LEGAL.PUBLIC_APP_URL}?ref=${encodeURIComponent(code)}`;
    const message = t(
      'settings.inviteShareWithCode',
      'Ascend\'i indir, davet kodumu kullan ve 10 streak donduru kazan: {{code}}\n{{link}}',
      { code, link },
    );
    try {
      await Share.share({ message });
    } catch {
      Alert.alert(
        t('settings.inviteShareErrorTitle', 'Paylaşım açılamadı'),
        t('settings.inviteShareError', 'Davetini paylaşamadık. Biraz sonra tekrar dene.'),
      );
    }
  };

  const handlePremiumStatusPress = () => {
    if (!isPremium) {
      navigation.navigate('Paywall', { source: 'settings_premium_status' });
      return;
    }
    Alert.alert(
      t('settings.premiumActiveTitle', 'Premium aktif'),
      t(
        'settings.premiumActiveBody',
        'Premium hesabında aktif. Abonelik yönetimi için App Store hesap ayarlarını kullanabilirsin.',
      ),
    );
  };

  const redeemCodeWithFeedback = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code) return;
    if (!isReferralCodeFormatValid(code)) {
      Alert.alert(
        t('settings.redeemErrorTitle', 'Hata'),
        t('settings.redeemInvalid', 'Kod geçersiz. Tekrar dene.'),
      );
      return;
    }
    setRedeeming(true);
    try {
      if (!user?.id) {
        await AsyncStorage.setItem(PENDING_REFERRAL_CODE_KEY, code);
        setRedeemModalVisible(false);
        Alert.alert(
          t('settings.redeemAuthRequiredTitle', 'Giriş yapman gerekiyor'),
          t('settings.redeemGuestSaved', 'Kodun kaydedildi. Ödülü almak için hesabına giriş yap.'),
          [
            { text: t('common.cancel', 'Daha sonra'), style: 'cancel' },
            { text: t('settings.signInForReferrals', 'Giriş yap'), onPress: leaveGuestMode },
          ],
        );
        return;
      }
      const result = await redeemReferralCode(code, user.id);
      if (result.ok) {
        grantReferralReward(result.rewardId);
        setRedeemModalVisible(false);
        setRedeemCodeInput('');
        Alert.alert(
          t('settings.redeemSuccessTitle', 'Tebrikler! 🎉'),
          t(
            'settings.redeemSuccessBody',
            '+10 streak donduru hesabına eklendi. Davet ettiğin kişiye de gönderildi.',
          ),
        );
        return;
      }
      const reason = result.reason;
      const messages = {
        invalid: t('settings.redeemInvalid', 'Kod geçersiz. Tekrar dene.'),
        own_code: t(
          'settings.redeemOwnCode',
          'Kendi kodunu kullanamazsın 🙂',
        ),
        already_redeemed: t(
          'settings.redeemAlreadyRedeemed',
          'Bu kod zaten başkası tarafından kullanılmış.',
        ),
        already_used_a_code: t(
          'settings.redeemAlreadyUsed',
          'Sen bir kod kullanmıştın zaten — sadece bir kez geçerli.',
        ),
        rate_limited: t(
          'settings.redeemRateLimited',
          'Çok fazla deneme yapıldı. Bir saat sonra tekrar dene.',
        ),
        auth_required: t(
          'settings.redeemAuthRequired',
          'Önce giriş yap.',
        ),
        error: t(
          'settings.redeemError',
          'Bir hata oluştu. Tekrar dener misin?',
        ),
      };
      Alert.alert(
        t('settings.redeemErrorTitle', 'Hata'),
        messages[reason] || messages.error,
      );
    } catch (error) {
      console.warn('[SettingsScreen] referral redemption handoff failed:', error?.message);
      Alert.alert(
        t('settings.redeemErrorTitle', 'Hata'),
        t('settings.redeemError', 'Bir hata oluştu. Tekrar dener misin?'),
      );
    } finally {
      setRedeeming(false);
    }
  };

  const handleRedeemCode = () => {
    setRedeemModalVisible(true);
  };

  const handleToggleVacation = () => {
    if (vacationActive) {
      Alert.alert(
        t('settings.vacationEndTitle', 'Tatil modu kapatılsın mı?'),
        t(
          'settings.vacationEndConfirm',
          'Tatil modu kapanırsa streak korumasının kalan günleri kaybolur.',
        ),
        [
          { text: t('common.cancel', 'İptal'), style: 'cancel' },
          {
            text: t('common.confirm', 'Onayla'),
            style: 'destructive',
            onPress: () => endVacation(),
          },
        ],
      );
      return;
    }
    if (!isPremium) {
      Alert.alert(
        t('settings.vacationPremiumTitle', 'Premium gerekli'),
        t(
          'settings.vacationPremiumBody',
          'Tatil modu sadece Premium üyelere açık. Premium\'a geç, 7 güne kadar streak\'ini koru.',
        ),
        [
          { text: t('common.cancel', 'İptal'), style: 'cancel' },
          {
            text: t('common.goPremium', "Premium'a geç"),
            onPress: () => navigation.navigate('Paywall', { source: 'vacation_mode' }),
          },
        ],
      );
      return;
    }
    Alert.alert(
      t('settings.vacationStartTitle', 'Tatil modunu aç (7 gün)'),
      t(
        'settings.vacationStartBody',
        '7 gün boyunca ders yapmasan da streak\'in sıfırlanmaz. İstediğin zaman kapatabilirsin.',
      ),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('common.start', 'Başlat'),
          onPress: () => startVacation(7),
        },
      ],
    );
  };

  const toggleSounds = (value) => {
    setSoundsEnabled(value);
    setMuted(!value);
  };

  const toggleHaptics = (value) => {
    setHapticsEnabledState(value);
    persistHapticsEnabled(value);
    if (value) hapticImpactLight();
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        setPremium(true);
        Alert.alert(
          t('settings.restoreSuccessTitle', 'Başarılı'),
          t('settings.restoreSuccessBody', 'Premium abonelik geri yüklendi.'),
        );
      } else {
        Alert.alert(
          t('settings.restoreEmptyTitle', 'Aktif abonelik yok'),
          t(
            'settings.restoreEmptyBody',
            'Bu Apple ID ile yapılmış aktif bir Premium abonelik bulunamadı.',
          ),
        );
      }
    } catch (e) {
      Alert.alert(
        t('common.error', 'Hata'),
        t(
          'settings.restoreFailedBody',
          'App Store bağlantısı kurulamadı. İnternetini kontrol edip tekrar dene.',
        ),
      );
    } finally {
      setRestoring(false);
    }
  };

  const toggleNotifications = async (value) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          t('settings.notifPermDeniedTitle', 'İzin verilmedi'),
          t(
            'settings.notifPermDeniedBody',
            'Bildirim göndermek için izin gerekli. Cihaz ayarlarından açabilirsin.',
          ),
        );
        setNotificationsEnabled(false);
        AsyncStorage.setItem(DAILY_REMINDER_ENABLED_KEY, 'false').catch(() => {});
        return;
      }
      try {
        await scheduleDailyReminder({ currentStreak, activePathId });
        setNotificationsEnabled(true);
        AsyncStorage.setItem(DAILY_REMINDER_ENABLED_KEY, 'true').catch(() => {});
      } catch {
        setNotificationsEnabled(false);
      }
    } else {
      await cancelAllNotifications();
      setNotificationsEnabled(false);
      AsyncStorage.setItem(DAILY_REMINDER_ENABLED_KEY, 'false').catch(() => {});
    }
  };

  const handleChangeLanguage = async (code) => {
    await setLanguage(code);
    setCurrentLang(code);
  };

  const handleSignOut = () => {
    Alert.alert(
      t('settings.signOutTitle', 'Çıkış yap'),
      t(
        'settings.signOutBody',
        'Hesabından çıkış yapmak istediğine emin misin? İlerlemen bu cihazda kalacak.',
      ),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('settings.logout', 'Çıkış Yap'),
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  };

  const handleResetProgress = () => {
    Alert.alert(
      t('settings.resetProgressTitle', 'İlerlemeyi Sıfırla'),
      t(
        'settings.resetProgressBody',
        'Tüm ders ilerlemen, streak\'in, XP\'in ve başarımların silinecek. Premium aboneliğin etkilenmez. Geri alınamaz.',
      ),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('common.reset', 'Sıfırla'),
          style: 'destructive',
          onPress: () => {
            resetProgress();
            Alert.alert(
              t('settings.resetDoneTitle', 'Sıfırlandı'),
              t('settings.resetDoneBody', 'İlerlemen sıfırlandı.'),
            );
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount', 'Hesabı Sil'),
      t(
        'settings.deleteAccountConfirm',
        'Hesabını silmek istediğine emin misin? Geri alınamaz.',
      ),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              const ok = await deleteAccount();
              if (!ok) {
                Alert.alert(
                  t('common.error', 'Hata'),
                  t(
                    'settings.deleteAccountFailed',
                    'Hesap silinemedi. İnternet bağlantını kontrol et ve tekrar dene.',
                  ),
                );
                return;
              }
              if (signOut) await signOut();
            } catch (e) {
              Alert.alert(
                t('common.error', 'Hata'),
                e?.message || t('common.tryAgain', 'Tekrar dene'),
              );
            }
          },
        },
      ],
    );
  };

  const version =
    Constants?.nativeApplicationVersion ||
    Constants?.expoConfig?.version ||
    '1.0.46';
  const buildNumber =
    Constants?.nativeBuildVersion ||
    Constants?.platform?.ios?.buildNumber ||
    Constants?.manifest?.ios?.buildNumber ||
    Constants?.expoConfig?.ios?.buildNumber ||
    '112';
  const referralCodeForCurrentUser = isAuthenticated && user?.id === referralCodeUserId
    ? myReferralCode
    : null;
  const referralCountForCurrentUser = referralCodeForCurrentUser ? referralCount : 0;
  const inviteStatus = !isAuthenticated
    ? t('settings.referralSignInHint', 'Davet kodunu kullanmak için hesabına giriş yap.')
    : referralLoading
      ? t('settings.referralCodeLoading', 'Davet kodun yükleniyor…')
      : referralLoadFailed
        ? t('settings.referralCodeUnavailable', 'Davet kodun alınamadı. Yeniden denemek için dokun.')
        : t('settings.referralCodeLoading', 'Davet kodun yükleniyor…');
  const inviteDisabled = !isAuthenticated || referralLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('common.back', 'Geri')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => navigation.goBack()}
            style={styles.headerBack}
          >
            <MaterialIcons name="arrow-back" size={22} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('settings.title', 'Ayarlar')}
          </Text>
          {isPremium ? (
            <View style={styles.premiumBadge}>
              <MaterialIcons name="auto-awesome" size={14} color={LT.onPrimary} />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <LanguageSection
            currentLang={currentLang}
            onChangeLanguage={handleChangeLanguage}
          />

          <PreferencesSection
            notificationsEnabled={notificationsEnabled}
            toggleNotifications={toggleNotifications}
            soundsEnabled={soundsEnabled}
            toggleSounds={toggleSounds}
            hapticsEnabled={hapticsEnabled}
            toggleHaptics={toggleHaptics}
          />

          <AccountSection
            user={user}
            referralCode={referralCodeForCurrentUser}
            referralCount={referralCountForCurrentUser}
            inviteStatus={inviteStatus}
            inviteDisabled={inviteDisabled}
            isPremium={isPremium}
            streakFreezes={streakFreezes}
            vacationActive={vacationActive}
            vacationUntil={vacationUntil}
            restoring={restoring}
            isAuthenticated={isAuthenticated}
            onInvite={handleInvite}
            onSignIn={leaveGuestMode}
            onRedeemCode={handleRedeemCode}
            onPremiumStatusPress={handlePremiumStatusPress}
            onToggleVacation={handleToggleVacation}
            onRestore={handleRestore}
            onSignOut={handleSignOut}
          />

          <DangerZoneSection
            onResetProgress={handleResetProgress}
            onDeleteAccount={handleDeleteAccount}
          />

          {__DEV__ ? (
            <SettingsSection title={t('settings.debug', 'TEŞHİS (DEBUG)')}>
              <TouchableOpacity
                onPress={() => setAdDebugOpen(true)}
                activeOpacity={0.7}
                style={styles.devRow}
              >
                <View style={styles.devRowLeft}>
                  <MaterialIcons
                    name="bug-report"
                    size={22}
                    color={LT.onSurfaceVariant}
                  />
                  <View>
                    <Text style={styles.devRowLabel}>
                      {t('settings.adDebug', 'Reklam Tanı')}
                    </Text>
                    <Text style={styles.devRowSub}>
                      {t(
                        'settings.adDebugSub',
                        'Reklam yüklenme durumu + son hatalar + ad unit ID\'leri',
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
            </SettingsSection>
          ) : null}

          <LegalSection version={version} buildNumber={buildNumber} />

          <View style={styles.footer}>
            <MaterialIcons name="self-improvement" size={56} color={LT.primaryContainer} />
            <Text style={styles.footerText}>
              {t('auth.tagline', 'Disiplin. Odak. Tekrar.')}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      <RedeemCodeModal
        visible={redeemModalVisible}
        onClose={() => {
          if (!redeeming) {
            setRedeemModalVisible(false);
            setRedeemCodeInput('');
          }
        }}
        redeeming={redeeming}
        redeemCodeInput={redeemCodeInput}
        setRedeemCodeInput={setRedeemCodeInput}
        onSubmit={redeemCodeWithFeedback}
      />

      <AdDebugModal
        visible={adDebugOpen}
        onClose={() => setAdDebugOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  container: { flex: 1, backgroundColor: LT.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: LT.surfaceContainer,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    marginLeft: 4,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: LT.primaryContainer,
    borderRadius: LT_RADIUS.pill,
    borderWidth: 1,
    borderColor: LT.primary,
  },
  premiumBadgeText: {
    color: LT.onPrimary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  footer: {
    alignItems: 'center',
    marginTop: 32,
    opacity: 0.5,
    gap: 8,
  },
  footerText: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },

  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  devRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  devRowLabel: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '600',
  },
  devRowSub: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
