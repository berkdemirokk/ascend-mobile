import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  SafeAreaView,
  Linking,
  StatusBar,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { LEGAL } from '../config/constants';
import { LT, LT_RADIUS } from '../config/lightTheme';
import { setLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES } from '../i18n';
import {
  requestNotificationPermissions,
  scheduleDailyReminder,
  cancelAllNotifications,
} from '../services/notifications';
import { restorePurchases } from '../services/purchases';
import {
  ensureMyReferral,
  redeemReferralCode,
  getReferralStats,
  codeFromUserId,
} from '../services/referral';
import { useAuth } from '../contexts/AuthContext';
import { setMuted, isMuted } from '../services/sounds';
import {
  getHapticsEnabled,
  setHapticsEnabled as persistHapticsEnabled,
  initHaptics,
  hapticImpactLight,
} from '../services/haptics';

const NOTIF_KEY = '@ascend/notifications_enabled_v1';
const SOUNDS_MUTED_KEY = '@ascend/sounds_muted_v1';

export default function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    isPremium,
    deleteAccount,
    setPremium,
    resetProgress,
    streakFreezes,
    vacationUntil,
    startVacation,
    endVacation,
    anonUsername,
    currentStreak,
    userProfile,
  } = useApp();

  const vacationActive = (() => {
    if (!vacationUntil) return false;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return vacationUntil >= todayStr;
  })();

  // Referral state — fetched lazily on Settings mount. We don't block
  // the screen on this; the share button just works with the code we
  // can derive locally from the user UID even before the server row is
  // confirmed.
  const { user } = useAuth();
  const { grantReferralReward } = useApp();
  const [referralCount, setReferralCount] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    // Ensure the server-side row exists (idempotent) and fetch stats.
    ensureMyReferral(user.id).catch(() => {});
    getReferralStats(user.id)
      .then((s) => setReferralCount(s.redemptions || 0))
      .catch(() => {});
  }, [user?.id]);

  const handleInvite = async () => {
    // Prefer the deterministic referral code (MONK-XXXX-YYYY). Falls
    // back to anonUsername for legacy users without a UID — they still
    // get a share-able message, just without a redeemable code.
    const code = (user?.id && codeFromUserId(user.id)) || anonUsername || null;
    const link = code
      ? `https://ascend.app/?ref=${encodeURIComponent(code)}`
      : 'https://ascend.app';
    const message = code
      ? t(
          'settings.inviteShareWithCode',
          'Ascend\'i indir, davet kodumu kullan ve 10 streak donduru kazan: {{code}}\n{{link}}',
          { code, link },
        )
      : t(
          'settings.inviteShare',
          'Disiplin akademisini birlikte yapalım — Ascend\'i indir, ilk 7 gün premium senden 🔥\n{{link}}',
          { link },
        );
    try {
      await Share.share({ message });
    } catch {
      // user dismissed or no share UI available
    }
  };

  const handleRedeemCode = () => {
    // Quick code-entry via native Alert prompt. Cross-platform: Alert.prompt
    // is iOS-only; on Android we'd need a modal but this app is iOS-first.
    Alert.prompt(
      t('settings.redeemTitle', 'Davet Kodu'),
      t(
        'settings.redeemBody',
        'Bir arkadaşının kodunu yaz — kabul edilirse ikinize de 10 streak donduru gelir.',
      ),
      async (rawCode) => {
        if (!rawCode) return;
        if (!user?.id) {
          Alert.alert(
            t('settings.redeemErrorTitle', 'Hata'),
            t(
              'settings.redeemAuthRequired',
              'Davet kodu kullanmak için hesabın olmalı. Önce giriş yap.',
            ),
          );
          return;
        }
        const result = await redeemReferralCode(rawCode, user.id);
        if (result.ok) {
          grantReferralReward();
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
      },
      'plain-text',
      '',
    );
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
            onPress: () => navigation.navigate('Paywall'),
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
  const { isAuthenticated, signOut } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [restoring, setRestoring] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SOUNDS_MUTED_KEY).then((v) => {
      setSoundsEnabled(v !== 'true');
    });
    // Sync the haptics toggle with the persisted preference. The service
    // already auto-loads on app boot (see App.js initHaptics), but we
    // call it again here in case the user lands on Settings on first
    // launch before that effect has resolved.
    initHaptics().then(() => setHapticsEnabledState(getHapticsEnabled()));
  }, []);

  const toggleSounds = (value) => {
    setSoundsEnabled(value);
    setMuted(!value); // sounds.js auto-persists
  };

  const toggleHaptics = (value) => {
    setHapticsEnabledState(value);
    persistHapticsEnabled(value); // haptics.js auto-persists
    // Fire a single light tap if turning ON so the user immediately
    // feels the feedback they just enabled (instant confirmation).
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
      Alert.alert(t('common.error', 'Hata'), e?.message || t('common.tryAgain'));
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      setNotificationsEnabled(v === 'true');
    });
  }, []);

  const toggleNotifications = async (value) => {
    if (value) {
      // Request permission, then schedule
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
        AsyncStorage.setItem(NOTIF_KEY, 'false').catch(() => {});
        return;
      }
      try {
        // Same archetype prefix rotation as the onboarding-time
        // schedule call. Settings-toggle path was missing this, so
        // users who turned notifications off + back on lost the
        // archetype echo until next onboarding reschedule.
        await scheduleDailyReminder({
          currentStreak,
          userName: userProfile?.name || '',
          archetypeName: userProfile?.archetype
            ? t(
                `archetypes.${
                  userProfile.archetype === 'zen-master'
                    ? 'zenMaster'
                    : userProfile.archetype === 'silent-warrior'
                      ? 'silentWarrior'
                      : 'ironDisciplined'
                }.name`,
                userProfile.archetype,
              )
            : '',
        });
      } catch (e) {
        console.warn('schedule daily reminder failed:', e?.message);
      }
      setNotificationsEnabled(true);
      AsyncStorage.setItem(NOTIF_KEY, 'true').catch(() => {});
    } else {
      try {
        await cancelAllNotifications();
      } catch (e) {
        console.warn('cancel notifications failed:', e?.message);
      }
      setNotificationsEnabled(false);
      AsyncStorage.setItem(NOTIF_KEY, 'false').catch(() => {});
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

  // Fallbacks track the current app.json — keep in sync when bumping version.
  const version = Constants?.expoConfig?.version || '1.0.10';
  const buildNumber =
    Constants?.expoConfig?.ios?.buildNumber ||
    Constants?.manifest?.ios?.buildNumber ||
    '24';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
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
          {/* Language */}
          <Section title={t('settings.language', 'DİL (LANGUAGE)')}>
            {SUPPORTED_LANGUAGES.map((l, idx, arr) => {
              const isLast = idx === arr.length - 1;
              const active = currentLang === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  onPress={() => handleChangeLanguage(l.code)}
                  activeOpacity={0.7}
                  style={[styles.row, !isLast && styles.rowBorder]}
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
          </Section>

          {/* Notifications */}
          <Section title={t('settings.notifications', 'BİLDİRİMLER (NOTIFICATIONS)')}>
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

            <View style={styles.row}>
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

            {/* Haptics toggle — service was created earlier but the
                UI to toggle it was missing. Mirrors sounds toggle. */}
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
          </Section>

          {/* Account */}
          <Section title={t('settings.account', 'HESAP (ACCOUNT)')}>
            <TouchableOpacity
              onPress={handleInvite}
              activeOpacity={0.7}
              style={[styles.row, styles.rowBorder]}
            >
              <View style={styles.rowLeft}>
                <MaterialIcons
                  name="card-giftcard"
                  size={22}
                  color={LT.primary}
                />
                <View>
                  <Text style={styles.rowLabel}>
                    {t('settings.invite', 'Arkadaşını davet et')}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {(() => {
                      const code =
                        (user?.id && codeFromUserId(user.id)) ||
                        anonUsername ||
                        '—';
                      return t(
                        'settings.inviteSubV2',
                        'Kodun: {{code}}{{tail}}',
                        {
                          code,
                          tail:
                            referralCount > 0
                              ? ` · ${referralCount} arkadaşın katıldı`
                              : ' · ikinize de 10 streak donduru',
                        },
                      );
                    })()}
                  </Text>
                </View>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={18}
                color={LT.onSurfaceVariant}
              />
            </TouchableOpacity>

            {/* Redeem invite code — counterpart to "Arkadaşını davet et"
                above. A user who joined organically can still redeem a
                code their friend sent later, picking up the same 10
                streak-freezes reward. One redemption per account
                (server-side unique constraint). */}
            <TouchableOpacity
              onPress={handleRedeemCode}
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
                      'Bir arkadaşının kodun varsa, 10 streak donduru kazan',
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
              onPress={() => navigation.navigate('Paywall')}
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
              onPress={handleToggleVacation}
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
              onPress={handleRestore}
              disabled={restoring}
              activeOpacity={0.7}
              style={[styles.row, styles.rowBorder]}
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

            {isAuthenticated && (
              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.7}
                style={[styles.row, styles.rowBorder]}
              >
                <View style={styles.rowLeft}>
                  <MaterialIcons name="logout" size={22} color={LT.onSurfaceVariant} />
                  <Text style={styles.rowLabel}>
                    {t('settings.logout', 'Çıkış Yap')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </Section>

          {/* Danger Zone */}
          <Section title={t('settings.dangerZone', 'TEHLİKELİ BÖLGE (DANGER ZONE)')}>
            <TouchableOpacity
              onPress={handleResetProgress}
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
              onPress={handleDeleteAccount}
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
          </Section>

          {/* Legal */}
          <Section title={t('settings.legal', 'YASAL (LEGAL)')}>
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
                {version} (Build {buildNumber})
              </Text>
            </View>
          </Section>

          {/* Footer mascot */}
          <View style={styles.footer}>
            <MaterialIcons name="self-improvement" size={56} color={LT.primaryContainer} />
            <Text style={styles.footerText}>
              MONK MODE • DIGITAL STOICISM
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
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
    letterSpacing: -0.4,
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

  section: { marginTop: 16 },
  sectionTitle: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: LT.surfaceContainerLowest,
    marginHorizontal: 20,
    borderRadius: LT_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },

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
  versionText: {
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },

  // Danger zone — destructive red background
  dangerRow: {
    backgroundColor: '#EF4444',
  },
  dangerLabel: {
    color: LT.onPrimary,
    fontWeight: '700',
  },

  flag: { fontSize: 22 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: LT.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: LT.primaryContainer },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: LT.primaryContainer,
  },

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
});
