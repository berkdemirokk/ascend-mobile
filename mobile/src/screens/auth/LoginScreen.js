import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { LT } from '../../config/lightTheme';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.includes('@')) {
      Alert.alert(t('common.error'), t('auth.invalidEmail', 'Geçerli bir e-posta gir'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordTooShort', 'Şifre en az 6 karakter olmalı'));
      return;
    }
    setLoading(true);
    const { error } = await signIn({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message || '';
      // Special-case "email not confirmed" — the user just needs to
      // click the verification link, but the raw English error has no
      // path forward. Offer a Resend button so they don't bounce off.
      if (/not.confirmed|email_not_confirmed|email.*verify/i.test(msg)) {
        Alert.alert(
          t('auth.checkEmail', 'E-postanı kontrol et'),
          t(
            'auth.emailNotConfirmed',
            'E-postanı doğrulamadın. Mailini kontrol et veya yeniden doğrulama maili gönder.',
          ),
          [
            { text: t('common.cancel', 'İptal'), style: 'cancel' },
            {
              text: t(
                'auth.resendConfirmation',
                'Doğrulama mailini yeniden gönder',
              ),
              onPress: async () => {
                try {
                  await supabase.auth.resend({ type: 'signup', email });
                  Alert.alert(
                    t('common.done', 'Tamam'),
                    t('auth.resendSent', 'Doğrulama maili yeniden gönderildi.'),
                  );
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
        return;
      }
      Alert.alert(t('common.error'), msg || t('auth.invalidCredentials'));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Background glow */}
          <View style={styles.bgGlow} pointerEvents="none" />

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-back" size={22} color={LT.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="lock" size={32} color={LT.primary} />
            </View>
            <Text style={styles.title}>
              {t('auth.welcomeBack', 'Tekrar hoşgeldin')}
            </Text>
            <Text style={styles.subtitle}>
              {t('auth.welcomeBackSub', 'Disiplin yolculuğuna devam et.')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.email', 'E-posta')}</Text>
              <View
                style={[
                  styles.inputWrap,
                  emailFocused && styles.inputWrapFocused,
                ]}
              >
                <MaterialIcons name="mail-outline" size={18} color={LT.onSurfaceVariant} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@mail.com"
                  placeholderTextColor={LT.onSurfaceVariant}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.password', 'Şifre')}</Text>
              <View
                style={[
                  styles.inputWrap,
                  pwFocused && styles.inputWrapFocused,
                ]}
              >
                <MaterialIcons name="lock-outline" size={18} color={LT.onSurfaceVariant} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={LT.onSurfaceVariant}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  style={styles.input}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={LT.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotBtn}
            >
              <Text style={styles.forgotText}>
                {t('auth.forgotPassword', 'Şifremi unuttum')}
              </Text>
            </TouchableOpacity>

            {/* CTA */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
              style={styles.ctaShadow}
            >
              <View style={[styles.ctaButton, loading && { opacity: 0.7 }]}>
                {loading ? (
                  <ActivityIndicator color={LT.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>
                      {t('auth.login', 'Giriş Yap')}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('auth.noAccount', 'Hesabın yok mu?')}{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.replace('Signup')}>
              <Text style={styles.footerLink}>
                {t('auth.signup', 'Kayıt ol')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  scroll: { padding: 24, paddingBottom: 40, flexGrow: 1 },

  bgGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: LT.outlineVariant,
    opacity: 0.25,
  },

  topBar: { marginBottom: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: LT.onSurface,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },

  form: { gap: 4, marginBottom: 24 },
  field: { marginBottom: 12 },
  label: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputWrapFocused: {
    borderColor: LT.primary,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '500',
  },

  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 8, marginBottom: 12 },
  forgotText: {
    color: LT.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  ctaShadow: {
    borderRadius: 16,
    backgroundColor: LT.primary,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: LT.primary,
  },
  ctaText: {
    color: LT.onPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  footerText: { color: LT.onSurfaceVariant, fontSize: 13, fontWeight: '500' },
  footerLink: {
    color: LT.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
