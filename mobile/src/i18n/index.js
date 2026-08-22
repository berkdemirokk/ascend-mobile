import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, NativeModules, Platform } from 'react-native';

import tr from './locales/tr.json';
import en from './locales/en.json';
import lessonsTR from './locales/lessons.tr.json';
import lessonsEN from './locales/lessons.en.json';

const STORAGE_KEY = 'ascend.language';
const SUPPORTED = ['tr', 'en'];
const DEFAULT_LANG = 'tr';

// Deep-merge so 'lessons' key is combined, not overwritten.
const merge = (base, extra) => {
  const out = { ...base };
  Object.keys(extra).forEach((k) => {
    if (
      typeof extra[k] === 'object' &&
      extra[k] !== null &&
      !Array.isArray(extra[k]) &&
      typeof out[k] === 'object' &&
      out[k] !== null &&
      !Array.isArray(out[k])
    ) {
      out[k] = merge(out[k], extra[k]);
    } else {
      out[k] = extra[k];
    }
  });
  return out;
};

const resources = {
  tr: { translation: merge(tr, lessonsTR) },
  en: { translation: merge(en, lessonsEN) },
  // Note: AR was removed for App Store v1. Apple flagged that AR users
  // would see TR lesson content (curriculum not yet translated). Re-add
  // when we have professionally translated lessons.
};

const getDeviceLanguageCode = () => {
  try {
    let raw;
    if (Platform.OS === 'ios') {
      raw =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
    } else {
      raw = NativeModules.I18nManager?.localeIdentifier;
    }
    if (!raw) return null;
    return String(raw).split(/[-_]/)[0]?.toLowerCase() || null;
  } catch {
    return null;
  }
};

const detectInitialLanguage = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {}

  const code = getDeviceLanguageCode();
  if (code && SUPPORTED.includes(code)) return code;

  return DEFAULT_LANG;
};

export const initI18n = async () => {
  const lng = await detectInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    // Both supported locales are kept in strict key parity by the
    // quality suite. Do not silently fall back to Turkish: that is how
    // a missing English key can create a mixed-language screen.
    fallbackLng: false,
    compatibilityJSON: 'v3',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  // RTL no longer needed since we removed AR. Keep helper in case we
  // re-add RTL languages later — but apply LTR explicitly.
  applyRTL(false);
  return i18n;
};

const applyRTL = (rtl) => {
  if (I18nManager.isRTL !== rtl) {
    try {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    } catch {}
  }
};

export const setLanguage = async (lng) => {
  if (!SUPPORTED.includes(lng)) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lng);
  } catch {}
  await i18n.changeLanguage(lng);
};

export const getCurrentLanguage = () => i18n.language || DEFAULT_LANG;

export const SUPPORTED_LANGUAGES = [
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export default i18n;
