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
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { LT } from '../../config/lightTheme';
import { LEGAL } from '../../config/constants';

export default function SignupScreen({ navigation }) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleSignup = async () => {
    if (!email.includes('@')) {
      Alert.alert(t('common.error'), t('auth.invalidEmail', 'Geçerli bir e-posta gir'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordTooShort', 'Şifre en az 6 karakter olmalı'));
      return;
    }
    setLoading(true);
    const { data, error } = await signUp({ email, password, name });
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), error.message || t('auth.invalidCredentials'));
      return;
    }
    // Supabase returns data.session when "Confirm email" is OFF in the
    // dashboard → user is auto-signed-in, AuthContext listener will
    // navigate. We do nothing here.
    if (data?.session) return;
    // Otherwise email-verification is required. Alert + send the user
    // back to Login so they can sign in after they confirm. Without
    // the navigation, the screen left them sitting on the signup form
    // and they'd often re-submit, hitting "Email not confirmed" loops.
    Alert.alert(
      t('auth.signupSuccess', 'Kayıt başarılı'),
      t(
        'auth.signupSuccessBody',
        'E-postanı kontrol et ve doğrulama linkine tıkla. Sonra giriş yap.',
      ),
      [
        {
          text: t('common.ok', 'Tamam'),
          onPress: () => {
            try {
              navigation.replace('Login');
            } catch {}
          },
        },
      ],
    );
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
          <View style={styles.bgGlow} pointerEvents="none" />

          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-back" size={22} color={LT.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="person-add" size={32} color={LT.primary} />
            </View>
            <Text style={styles.title}>
              {t('auth.createAccount', 'Hesap oluştur')}
            </Text>
            <Text style={styles.subtitle}>
              {t('auth.createAccountSub', 'İlk dersini ücretsiz aç.')}
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              label={t('auth.name', 'İsim')}
              placeholder={t('auth.namePlaceholder', 'Adın')}
              value={name}
              onChangeText={setName}
              icon="person-outline"
              focused={focusedField === 'name'}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="words"
            />

            <Field
              label={t('auth.email', 'E-posta')}
              placeholder="example@mail.com"
              value={email}
              onChangeText={setEmail}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              focused={focusedField === 'email'}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />

            <Field
              label={t('auth.password', 'Şifre')}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              icon="lock-outline"
              secureTextEntry={!showPassword}
              focused={focusedField === 'password'}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              rightIcon={showPassword ? 'visibility-off' : 'visibility'}
              onRightPress={() => setShowPassword(!showPassword)}
              hint={t('auth.passwordHint', 'En az 6 karakter')}
            />

            <TouchableOpacity
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.9}
              style={[styles.ctaShadow, { marginTop: 12 }]}
            >
              <View style={[styles.ctaButton, loading && { opacity: 0.7 }]}>
                {loading ? (
                  <ActivityIndicator color={LT.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.ctaText}>
                      {t('auth.signup', 'Kayıt Ol')}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
                  </>
                )}
              </View>
            </TouchableOpacity>

            <Text style={styles.legalText}>
              {t('auth.legalAgreePrefix', 'Kayıt olarak ')}
              <Text
                style={styles.legalLink}
                onPress={() =>
                  Linking.openURL(LEGAL.TERMS_URL).catch(() => {})
                }
              >
                {t('auth.legalTerms', 'Kullanım Koşulları')}
              </Text>
              {t('auth.legalAgreeAnd', ' ve ')}
              <Text
                style={styles.legalLink}
                onPress={() =>
                  Linking.openURL(LEGAL.PRIVACY_URL).catch(() => {})
                }
              >
                {t('auth.legalPrivacy', 'Gizlilik Politikamızı')}
              </Text>
              {t('auth.legalAgreeSuffix', ' kabul etmiş olursun.')}
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('auth.hasAccount', 'Zaten hesabın var mı?')}{' '}
            </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.footerLink}>
                {t('auth.login', 'Giriş yap')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  icon,
  rightIcon,
  onRightPress,
  focused,
  hint,
  ...inputProps
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <MaterialIcons name={icon} size={18} color={LT.onSurfaceVariant} />
        <TextInput
          placeholderTextColor={LT.onSurfaceVariant}
          style={styles.input}
          {...inputProps}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name={rightIcon} size={20} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
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

  hero: { alignItems: 'center', marginBottom: 32 },
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

  form: { marginBottom: 24 },
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
  hint: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
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

  legalText: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  legalLink: {
    color: LT.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  footerText: { color: LT.onSurfaceVariant, fontSize: 13, fontWeight: '500' },
  footerLink: { color: LT.primary, fontSize: 13, fontWeight: '800' },
});
