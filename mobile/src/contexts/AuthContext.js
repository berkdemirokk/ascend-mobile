import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../services/supabase';
import { unlinkPurchaseUser } from '../services/purchases';

// Cap network calls so a slow/offline reviewer doesn't see a frozen splash.
// Tagged result: `timedOut: true` lets the caller distinguish "no session"
// from "couldn't determine yet" so we don't immediately bounce a real user
// to the Welcome screen on slow networks (~5s is common on cellular).
export const withTimeout = (promise, ms) =>
  Promise.race([
    promise.then((value) => (
      value && typeof value === 'object'
        ? { ...value, timedOut: false }
        : { data: value ?? null, timedOut: false }
    )),
    new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, timedOut: true }), ms),
    ),
  ]);

const AuthContext = createContext(null);
export const AUTH_REQUEST_TIMEOUT_MS = 12000;

const makeAuthError = (code, message) =>
  Object.assign(new Error(message || code), { code });

const normalizeAuthError = (error) => {
  if (error?.code) return error;
  const message = error?.message || '';
  if (/network|fetch|dns|offline|timed?\s*out|request\s+failed/i.test(message)) {
    return makeAuthError('ASCEND_AUTH_REQUEST_FAILED', message);
  }
  if (message) return error;
  if (typeof error === 'string') return makeAuthError('ASCEND_AUTH_REQUEST_FAILED', error);
  return makeAuthError(
    'ASCEND_AUTH_REQUEST_FAILED',
    'Authentication request failed.',
  );
};

export const runAuthRequest = async (
  requestFactory,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
) => {
  try {
    const result = await withTimeout(Promise.resolve().then(requestFactory), timeoutMs);
    if (result?.timedOut) {
      return {
        data: null,
        error: makeAuthError(
          'ASCEND_AUTH_TIMEOUT',
          'Authentication service did not respond in time.',
        ),
        timedOut: true,
      };
    }
    return result || { data: null, error: null };
  } catch (error) {
    return { data: null, error: normalizeAuthError(error) };
  }
};

export const getAuthErrorMessage = (
  t,
  error,
  fallbackKey = 'auth.invalidCredentials',
) => {
  const code = error?.code || '';
  if (code === 'ASCEND_AUTH_NOT_CONFIGURED') {
    return t(
      'auth.serviceNotConfigured',
      'Bulut bağlantısı hazır değil. Misafir olarak devam edebilir veya biraz sonra tekrar deneyebilirsin.',
    );
  }
  if (code === 'ASCEND_AUTH_TIMEOUT') {
    return t(
      'auth.serviceTimeout',
      'Bulut bağlantısı cevap vermedi. İnternetini kontrol edip tekrar dene veya misafir olarak devam et.',
    );
  }
  if (code === 'ASCEND_AUTH_REQUEST_FAILED') {
    return t(
      'auth.serviceUnavailable',
      'Bulut bağlantısına ulaşılamıyor. Biraz sonra tekrar dene veya misafir olarak devam et.',
    );
  }
  if (code === 'ASCEND_APPLE_MODULE_UNAVAILABLE') {
    return t(
      'auth.appleModuleUnavailable',
      'Apple ile giriş modülü bu build içinde yüklenemedi.',
    );
  }
  if (code === 'ASCEND_APPLE_UNAVAILABLE') {
    return t(
      'auth.appleUnavailable',
      'Apple ile giriş bu cihazda kullanılamıyor.',
    );
  }
  if (code === 'ASCEND_APPLE_MISSING_TOKEN') {
    return t(
      'auth.appleSignInGenericError',
      'Apple ile giriş başarısız oldu. Tekrar dene.',
    );
  }
  return (
    error?.message ||
    error?.error_description ||
    (typeof error === 'string' ? error : null) ||
    t(fallbackKey)
  );
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);

  // Bootstrap: hydrate session, subscribe to changes
  useEffect(() => {
    let unsub;
    // `mounted` guards against the race where the component unmounts
    // BEFORE the async IIFE finishes registering the auth listener.
    // Without it, cleanup runs early (unsub is still undefined), the
    // IIFE later attaches the listener, and nothing ever unsubscribes
    // it — leaking subscriptions on every fast sign-out/sign-in cycle
    // until the app is killed.
    let mounted = true;

    (async () => {
      try {
        if (!SUPABASE_CONFIGURED) {
          // Supabase not configured — fall back to guest mode so the app
          // still works locally.
          setGuestMode(true);
          setLoading(false);
          return;
        }
        const sessionRequest = supabase.auth.getSession();
        const result = await withTimeout(sessionRequest, 5000);
        if (!mounted) return;
        setSession(result?.data?.session ?? null);
        // Never leave the launch screen blocked on network state. Keep the
        // original request alive in the background so a persisted session
        // can still restore when connectivity returns, without starting a
        // second unbounded request.
        if (result?.timedOut) {
          setLoading(false);
          sessionRequest
            .then(({ data }) => {
              if (mounted && data?.session) setSession(data.session);
            })
            .catch((e) => {
              console.warn('[AuthContext] late getSession failed:', e?.message);
            });
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.warn('[AuthContext] getSession failed:', e?.message);
        if (mounted) setLoading(false);
      }

      if (SUPABASE_CONFIGURED && mounted) {
        const { data: listener } = supabase.auth.onAuthStateChange(
          (_event, s) => {
            setSession(s);
          },
        );
        unsub = listener?.subscription;
        // If we already unmounted while waiting for the async work,
        // tear the just-attached subscription down ourselves —
        // otherwise it leaks because the React cleanup already ran.
        if (!mounted) {
          try { unsub?.unsubscribe?.(); } catch {}
          unsub = undefined;
        }
      }
    })();

    return () => {
      mounted = false;
      try {
        unsub?.unsubscribe?.();
      } catch {}
    };
  }, []);

  const signUp = useCallback(async ({ email, password, name }) => {
    if (!SUPABASE_CONFIGURED) {
      return {
        error: makeAuthError(
          'ASCEND_AUTH_NOT_CONFIGURED',
          'Authentication service is not configured.',
        ),
      };
    }
    const { data, error } = await runAuthRequest(() => supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { name: name?.trim() || null },
      },
    }));
    return { data, error };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!SUPABASE_CONFIGURED) {
      return {
        error: makeAuthError(
          'ASCEND_AUTH_NOT_CONFIGURED',
          'Authentication service is not configured.',
        ),
      };
    }
    const { data, error } = await runAuthRequest(() => supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    }));
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    // Unlink RevenueCat first so the next sign-in starts fresh and the
    // anonymous user from logout doesn't keep the previous user's entitlements.
    try {
      await unlinkPurchaseUser();
    } catch (e) {
      console.warn('[AuthContext] unlinkPurchaseUser failed:', e?.message);
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthContext] signOut failed:', e?.message);
    }
    setGuestMode(false);
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!SUPABASE_CONFIGURED) {
      return {
        error: makeAuthError(
          'ASCEND_AUTH_NOT_CONFIGURED',
          'Authentication service is not configured.',
        ),
      };
    }
    // Pass redirectTo so the email link deep-links back into the app
    // (ascend:// scheme is registered in app.json). Without this the
    // reset link lands on whatever the Supabase dashboard has set as
    // its site URL — typically a web page the mobile user can't
    // complete the flow from. The scheme handler is wired in App.js.
    // If the user opens the link on a desktop, they'll still land on
    // Supabase's web reset page and can change password there.
    const { data, error } = await runAuthRequest(() => supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'ascend://reset-password' },
    ));
    return { data, error };
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    if (!SUPABASE_CONFIGURED) {
      return {
        error: makeAuthError(
          'ASCEND_AUTH_NOT_CONFIGURED',
          'Authentication service is not configured.',
        ),
      };
    }
    const { data, error } = await runAuthRequest(() =>
      supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() }),
    );
    return { data, error };
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuestMode(true);
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!SUPABASE_CONFIGURED) {
      return {
        error: makeAuthError(
          'ASCEND_AUTH_NOT_CONFIGURED',
          'Authentication service is not configured.',
        ),
      };
    }
    try {
      const AppleAuthentication = await import('expo-apple-authentication').catch(() => null);
      const Crypto = await import('expo-crypto').catch(() => null);
      if (!AppleAuthentication || !Crypto) {
        return {
          error: makeAuthError(
            'ASCEND_APPLE_MODULE_UNAVAILABLE',
            'Apple Sign-In module is unavailable in this build.',
          ),
        };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          error: makeAuthError(
            'ASCEND_APPLE_UNAVAILABLE',
            'Apple Sign-In is unavailable on this device.',
          ),
        };
      }

      const rawNonce = Crypto.randomUUID
        ? Crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential?.identityToken) {
        return {
          error: makeAuthError(
            'ASCEND_APPLE_MISSING_TOKEN',
            'Apple Sign-In did not return an identity token.',
          ),
        };
      }

      const { data, error } = await runAuthRequest(() => supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      }));

      return { data, error };
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        return { canceled: true };
      }
      return { error: normalizeAuthError(e) };
    }
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    guestMode,
    isAuthenticated: !!session?.user,
    configured: SUPABASE_CONFIGURED,
    signUp,
    signIn,
    signInWithApple,
    signOut,
    resetPassword,
    resendConfirmation,
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
