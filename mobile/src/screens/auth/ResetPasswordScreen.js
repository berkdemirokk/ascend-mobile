import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import {
  AccessibleTouchableOpacity as TouchableOpacity,
} from '../../components/AccessibleControls';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import {
  getAuthErrorMessage,
  runAuthRequest,
  useAuth,
} from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { getLastDeepLinkUrl } from '../../services/deepLinks';
import { supabase, SUPABASE_CONFIGURED } from '../../services/supabase';
import { LT } from '../../config/lightTheme';

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return value || '';
  }
};

const parseLinkParams = (url, routeParams = {}) => {
  const out = { ...(routeParams || {}) };
  const raw = String(url || '');
  const chunks = [];
  const queryIndex = raw.indexOf('?');
  const hashIndex = raw.indexOf('#');
  if (queryIndex >= 0) {
    const end = hashIndex >= 0 ? hashIndex : raw.length;
    chunks.push(raw.slice(queryIndex + 1, end));
  }
  if (hashIndex >= 0) chunks.push(raw.slice(hashIndex + 1));

  chunks
    .join('&')
    .split('&')
    .filter(Boolean)
    .forEach((pair) => {
      const [key, ...valueParts] = pair.split('=');
      if (!key) return;
      const value = valueParts.join('=');
      out[safeDecode(key)] = safeDecode(value);
    });
  return out;
};

export default function ResetPasswordScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { onboarded } = useApp();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!SUPABASE_CONFIGURED) {
        if (mounted) {
          setPreparing(false);
          setSessionReady(false);
        }
        return;
      }

      const initialUrl = await Linking.getInitialURL().catch(() => null);
      const params = parseLinkParams(
        getLastDeepLinkUrl() || initialUrl,
        route?.params,
      );
      const linkError = params.error_description || params.error;
      if (linkError) {
        if (mounted) {
          setPreparing(false);
          setSessionReady(false);
        }
        return;
      }

      let error = null;
      if (params.access_token && params.refresh_token) {
        ({ error } = await runAuthRequest(() => supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        })));
      } else if (params.token_hash || params.token) {
        ({ error } = await runAuthRequest(() => supabase.auth.verifyOtp({
          token_hash: params.token_hash || params.token,
          type: 'recovery',
        })));
      } else if (params.code) {
        ({ error } = await runAuthRequest(() =>
          supabase.auth.exchangeCodeForSession(params.code),
        ));
      } else {
        const result = await runAuthRequest(() => supabase.auth.getSession(), 5000);
        error = result.error;
        if (!result?.data?.session) {
          error = error || new Error('Missing recovery session');
        }
      }

      if (!mounted) return;
      setSessionReady(!error);
      setPreparing(false);
    })();
    return () => {
      mounted = false;
    };
  }, [route?.params]);

  const finish = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace(isAuthenticated ? (onboarded ? 'MainTabs' : 'Onboarding') : 'Welcome');
    }
  };

  const handleSave = async () => {
    if (!sessionReady) {
      Alert.alert(
        t('common.error', 'Error'),
        t(
          'auth.resetLinkInvalid',
          'This reset link is expired or incomplete. Send yourself a new link.',
        ),
      );
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        t('common.error', 'Error'),
        t('auth.passwordTooShort', 'Password must be at least 6 characters'),
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        t('common.error', 'Error'),
        t('auth.passwordMismatch', 'Passwords do not match'),
      );
      return;
    }

    setSaving(true);
    let error = null;
    try {
      ({ error } = await runAuthRequest(() => supabase.auth.updateUser({ password })));
    } catch (e) {
      error = e;
    } finally {
      setSaving(false);
    }

    if (error) {
      Alert.alert(
        t('common.error', 'Error'),
        getAuthErrorMessage(t, error, 'common.tryAgain'),
      );
      return;
    }

    Alert.alert(
      t('auth.passwordUpdatedTitle', 'Password updated'),
      t('auth.passwordUpdatedBody', 'You can continue with your new password.'),
      [{ text: t('common.done', 'Done'), onPress: finish }],
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
          <View style={styles.topBar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('common.close', 'Close')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={finish}
              style={styles.backBtn}
            >
              <MaterialIcons name="close" size={22} color={LT.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="lock-reset" size={32} color={LT.primary} />
            </View>
            <Text style={styles.title}>
              {t('auth.newPasswordTitle', 'Set a new password')}
            </Text>
            <Text style={styles.subtitle}>
              {preparing
                ? t('auth.resetPreparing', 'Checking your reset link...')
                : sessionReady
                  ? t(
                      'auth.newPasswordSub',
                      'Choose a password you can remember. It must be at least 6 characters.',
                    )
                  : t(
                      'auth.resetLinkInvalid',
                      'This reset link is expired or incomplete. Send yourself a new link.',
                    )}
            </Text>
          </View>

          {preparing ? (
            <ActivityIndicator color={LT.primary} size="large" />
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t('auth.newPassword', 'New password')}
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    passwordFocused && styles.inputWrapFocused,
                  ]}
                >
                  <MaterialIcons name="lock-outline" size={18} color={LT.onSurfaceVariant} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.passwordHint', 'At least 6 characters')}
                    placeholderTextColor={LT.onSurfaceVariant}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    editable={sessionReady && !saving}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={showPassword
                      ? t('auth.hidePassword', 'Hide password')
                      : t('auth.showPassword', 'Show password')}
                    onPress={() => setShowPassword((v) => !v)}
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

              <View style={styles.field}>
                <Text style={styles.label}>
                  {t('auth.confirmPassword', 'Confirm password')}
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    confirmFocused && styles.inputWrapFocused,
                  ]}
                >
                  <MaterialIcons name="check-circle-outline" size={18} color={LT.onSurfaceVariant} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t('auth.confirmPassword', 'Confirm password')}
                    placeholderTextColor={LT.onSurfaceVariant}
                    secureTextEntry={!showPassword}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                    editable={sessionReady && !saving}
                    style={styles.input}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={!sessionReady || saving}
                activeOpacity={0.9}
                style={[styles.ctaShadow, (!sessionReady || saving) && styles.ctaDisabled]}
              >
                <View style={styles.ctaButton}>
                  {saving ? (
                    <ActivityIndicator color={LT.onPrimary} />
                  ) : (
                    <>
                      <Text style={styles.ctaText}>
                        {t('auth.updatePassword', 'Update password')}
                      </Text>
                      <MaterialIcons name="arrow-forward" size={20} color={LT.onPrimary} />
                    </>
                  )}
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
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
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
  ctaShadow: {
    borderRadius: 16,
    backgroundColor: LT.primary,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaDisabled: {
    opacity: 0.55,
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
