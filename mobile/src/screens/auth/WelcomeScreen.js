import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { LT } from '../../config/lightTheme';
import { setLanguage, getCurrentLanguage, SUPPORTED_LANGUAGES } from '../../i18n';

export default function WelcomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { continueAsGuest, configured, signInWithApple } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    (async () => {
      try {
        const mod = await import('expo-apple-authentication');
        const ok = await mod.isAvailableAsync();
        setAppleAvailable(!!ok);
      } catch {
        setAppleAvailable(false);
      }
    })();
  }, []);

  const handleApple = async () => {
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (result?.canceled) return;
      // Surface ANY error shape — Supabase can return `error.message`
      // directly, or a plain string, or a generic object (we've seen
      // "Invalid token" without .message). Apple reviewers test Apple
      // Sign-In and a silent black-hole is a guaranteed rejection.
      if (result?.error) {
        const errObj = result.error;
        const msg =
          errObj?.message ||
          errObj?.error_description ||
          (typeof errObj === 'string' ? errObj : null) ||
          t('auth.appleSignInGenericError', 'Apple ile giriş başarısız oldu. Tekrar dene.');
        Alert.alert(t('common.error', 'Hata'), msg);
        return;
      }
      // Defensive: even if no error, if there's no session shape, alert.
      if (!result?.data?.session && !result?.session) {
        Alert.alert(
          t('common.error', 'Hata'),
          t(
            'auth.appleSignInGenericError',
            'Apple ile giriş başarısız oldu. Tekrar dene.',
          ),
        );
      }
    } catch (e) {
      Alert.alert(
        t('common.error', 'Hata'),
        e?.message ||
          t(
            'auth.appleSignInGenericError',
            'Apple ile giriş başarısız oldu. Tekrar dene.',
          ),
      );
    } finally {
      setAppleLoading(false);
    }
  };

  const handleChangeLang = async (code) => {
    await setLanguage(code);
    setCurrentLang(code);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />
      <View style={styles.container}>
        {/* Ambient glow background */}
        <View style={styles.heroGlow} pointerEvents="none" />

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.iconImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brand}>MONK MODE</Text>
          <Text style={styles.tagline}>
            {t('auth.tagline', 'Disiplin. Odak. Tekrar.')}
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          {appleAvailable ? (
            <TouchableOpacity
              style={styles.appleBtn}
              activeOpacity={0.85}
              onPress={handleApple}
              disabled={appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.appleIcon}></Text>
                  <Text style={styles.appleText}>
                    {t('auth.signInWithApple', 'Apple ile devam et')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.primaryBtnWrap}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Signup')}
          >
            <View style={styles.primaryBtn}>
              <MaterialIcons name="email" size={18} color={LT.onPrimary} />
              <Text style={styles.primaryText}>
                {t('auth.signupWithEmail', 'E-posta ile kayıt ol')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryText}>
              {t('auth.haveAccount', 'Zaten hesabım var')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestBtn}
            activeOpacity={0.7}
            onPress={continueAsGuest}
          >
            <Text style={styles.guestText}>
              {t('auth.guestMode', 'Misafir olarak devam et')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Language switcher */}
        <View style={styles.langRow}>
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = currentLang === l.code;
            return (
              <TouchableOpacity
                key={l.code}
                onPress={() => handleChangeLang(l.code)}
                activeOpacity={0.7}
                style={[styles.langChip, active && styles.langChipActive]}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text
                  style={[
                    styles.langLabel,
                    active && styles.langLabelActive,
                  ]}
                >
                  {l.code.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!configured ? (
          <Text style={styles.warningText}>
            ⚠ {t('auth.notConfigured', 'Bulut bağlantısı yok — sadece misafir modu çalışır')}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'space-between',
    backgroundColor: LT.background,
  },

  heroGlow: {
    position: 'absolute',
    top: '15%',
    left: '50%',
    width: 320,
    height: 320,
    marginLeft: -160,
    borderRadius: 160,
    backgroundColor: LT.outlineVariant,
    opacity: 0.25,
  },

  hero: {
    alignItems: 'center',
    marginTop: 32,
    flex: 1,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 144,
    height: 144,
    borderRadius: 72,
    overflow: 'hidden',
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 2,
    borderColor: LT.outlineVariant,
    marginBottom: 24,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconImage: { width: '100%', height: '100%' },
  brand: {
    color: LT.onSurface,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  buttons: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  appleBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appleIcon: { fontSize: 18, color: '#FFFFFF' },
  appleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  primaryBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: LT.primary,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtn: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
  },
  primaryText: { color: LT.onPrimary, fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  secondaryText: { color: LT.primary, fontSize: 14, fontWeight: '700' },
  guestBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  guestText: { color: LT.onSurfaceVariant, fontSize: 13, fontWeight: '600' },

  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLowest,
  },
  langChipActive: {
    borderColor: LT.primary,
    backgroundColor: LT.surfaceContainerLow,
  },
  langFlag: { fontSize: 14 },
  langLabel: { color: LT.onSurfaceVariant, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  langLabelActive: { color: LT.primary },

  warningText: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
