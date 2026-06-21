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
import { getAuthErrorMessage, useAuth } from '../../contexts/AuthContext';
import { LT } from '../../config/lightTheme';

export default function ForgotPasswordScreen({ navigation }) {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const handleReset = async () => {
    if (!email.includes('@')) {
      Alert.alert(t('common.error'), t('auth.invalidEmail', 'Geçerli bir e-posta gir'));
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      Alert.alert(
        t('common.error'),
        getAuthErrorMessage(t, error, 'common.tryAgain'),
      );
      return;
    }
    setSent(true);
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
              accessibilityRole="button"
              accessibilityLabel={t('common.back', 'Geri')}
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-back" size={22} color={LT.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <MaterialIcons
                name={sent ? 'mark-email-read' : 'lock-reset'}
                size={32}
                color={sent ? LT.success : LT.primary}
              />
            </View>
            <Text style={styles.title}>
              {sent
                ? t('auth.checkEmail', 'E-postanı kontrol et')
                : t('auth.forgotPasswordTitle', 'Şifreni mi unuttun?')}
            </Text>
            <Text style={styles.subtitle}>
              {sent
                ? t(
                    'auth.resetSentBody',
                    'Sıfırlama linki gönderildi. Spam klasörüne de bakmayı unutma.',
                  )
                : t(
                    'auth.forgotPasswordSub',
                    'E-posta adresine sıfırlama linki gönderelim.',
                  )}
            </Text>
          </View>

          {!sent ? (
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

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.9}
                style={[styles.ctaShadow, { marginTop: 8 }]}
              >
                <View style={[styles.ctaButton, loading && { opacity: 0.7 }]}>
                  {loading ? (
                    <ActivityIndicator color={LT.onPrimary} />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color={LT.onPrimary} />
                      <Text style={styles.ctaText}>
                        {t('auth.sendResetLink', 'Sıfırlama linki gönder')}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.successBox}>
              <View style={styles.successCheckCircle}>
                <MaterialIcons name="check" size={32} color={LT.success} />
              </View>
              <Text style={styles.successText}>{email}</Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.ctaShadow, { width: '100%', marginTop: 24 }]}
                activeOpacity={0.9}
              >
                <View style={styles.ctaButton}>
                  <Text style={styles.ctaText}>
                    {t('auth.backToLogin', 'Girişe dön')}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
                </View>
              </TouchableOpacity>
            </View>
          )}
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
    letterSpacing: 0,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
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

  successBox: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  successCheckCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successText: {
    color: LT.onSurface,
    fontSize: 14,
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
});
