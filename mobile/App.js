import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/contexts/AppContext';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initPurchases } from './src/services/purchases';
import { initI18n } from './src/i18n';
import { initHaptics } from './src/services/haptics';
import {
  setupNotifCategories,
  setupNotifResponseListener,
} from './src/services/notifications';
import { LT } from './src/config/lightTheme';
import { getThemedLT } from './src/config/theme';

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  // System color scheme — used to swap status bar tint + splash
  // background so a user with system dark mode doesn't get a white
  // flash on cold start. Full per-screen dark migration is a future
  // sprint; this is phase 1.
  const scheme = useColorScheme();
  const T = getThemedLT(scheme);

  useEffect(() => {
    initI18n()
      .catch((e) => console.warn('i18n init failed:', e?.message))
      .finally(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    // Load the user's haptics-enabled preference (persisted in
    // AsyncStorage). Sync internally and no-ops if storage is empty —
    // default is "on". Fire-and-forget; non-critical.
    initHaptics().catch(() => {});

    // Register notification categories ("Start Lesson" action button)
    // and wire the response listener so tapping the action navigates
    // the user back into the lessons flow. Idempotent on each boot.
    setupNotifCategories().catch(() => {});
    setupNotifResponseListener();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initPurchases();
      } catch (e) {
        console.warn('Purchases init failed:', e?.message);
      }
      // AdMob is NOT initialized here on purpose. Apple Review (submission
      // 52b37ca1) flagged the previous build for ATT-related concerns. We
      // now defer the ad SDK boot to OnboardingScreen.finishOnboarding,
      // right AFTER the ATT prompt resolves — so no third-party SDK loads
      // before the user has seen and answered the tracking permission
      // request.
      //
      // Notifications are also deferred to onboarding-end for the same
      // "ask at a meaningful moment" reason (Apple guideline 5.1.1).
    })();
  }, []);

  if (!i18nReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: T.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={T.primaryContainer} size="large" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: T.background }}>
        <SafeAreaProvider>
          <AuthProvider>
            <AppProvider>
              {/* StatusBar tint reacts to system color scheme so the
                  clock + battery icons stay legible against whichever
                  background the screens render. */}
              <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
              <AppNavigator />
            </AppProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
