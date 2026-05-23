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
const withTimeout = (promise, ms) =>
  Promise.race([
    promise.then((value) => ({ ...value, timedOut: false })),
    new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, timedOut: true }), ms),
    ),
  ]);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);

  // Bootstrap: hydrate session, subscribe to changes
  useEffect(() => {
    let unsub;

    (async () => {
      try {
        if (!SUPABASE_CONFIGURED) {
          // Supabase not configured — fall back to guest mode so the app
          // still works locally.
          setGuestMode(true);
          setLoading(false);
          return;
        }
        const result = await withTimeout(supabase.auth.getSession(), 5000);
        setSession(result?.data?.session ?? null);
        // If the call timed out, leave `loading` as-is so the splash
        // keeps showing AND kick off an un-timed background re-fetch.
        // The onAuthStateChange listener registered below will also
        // surface any session that arrives later, so the user doesn't
        // get bounced to Welcome and re-asked to sign in on a slow
        // network.
        if (result?.timedOut) {
          supabase.auth
            .getSession()
            .then(({ data }) => {
              if (data?.session) setSession(data.session);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.warn('[AuthContext] getSession failed:', e?.message);
        setLoading(false);
      }

      if (SUPABASE_CONFIGURED) {
        const { data: listener } = supabase.auth.onAuthStateChange(
          (_event, s) => {
            setSession(s);
          },
        );
        unsub = listener?.subscription;
      }
    })();

    return () => {
      try {
        unsub?.unsubscribe?.();
      } catch {}
    };
  }, []);

  const signUp = useCallback(async ({ email, password, name }) => {
    if (!SUPABASE_CONFIGURED) {
      return { error: new Error('Supabase henüz yapılandırılmadı.') };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { name: name?.trim() || null },
      },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!SUPABASE_CONFIGURED) {
      return { error: new Error('Supabase henüz yapılandırılmadı.') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
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
      return { error: new Error('Supabase henüz yapılandırılmadı.') };
    }
    // Pass redirectTo so the email link deep-links back into the app
    // (ascend:// scheme is registered in app.json). Without this the
    // reset link lands on whatever the Supabase dashboard has set as
    // its site URL — typically a web page the mobile user can't
    // complete the flow from. The scheme handler is wired in App.js.
    // If the user opens the link on a desktop, they'll still land on
    // Supabase's web reset page and can change password there.
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'ascend://reset-password' },
    );
    return { data, error };
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuestMode(true);
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!SUPABASE_CONFIGURED) {
      return { error: new Error('Supabase henüz yapılandırılmadı.') };
    }
    try {
      const AppleAuthentication = await import('expo-apple-authentication').catch(() => null);
      const Crypto = await import('expo-crypto').catch(() => null);
      if (!AppleAuthentication || !Crypto) {
        return { error: new Error('Apple Sign-In modülü yüklenemedi.') };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { error: new Error('Apple Sign-In bu cihazda kullanılamıyor.') };
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
        return { error: new Error('Apple kimlik doğrulaması başarısız.') };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      return { data, error };
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        return { canceled: true };
      }
      return { error: e };
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
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
