// useWhatsNew — drives the post-update "Yenilikler" modal.
//
// On first render after launch:
//   1. Read LAST_SEEN_VERSION from AsyncStorage.
//   2. Compare to Constants.expoConfig.version.
//   3. If equal → no-op, hide modal.
//   4. If different AND a WHATS_NEW entry exists for the current
//      version → show the modal.
//   5. If LAST_SEEN_VERSION is missing (first install) → DON'T show
//      the modal. New users are about to enter onboarding; popping
//      a "what's new" card on top of welcome would be jarring. We
//      just stamp the current version so future upgrades work.
//
// Dismissal writes the current version to LAST_SEEN_VERSION so the
// next launch doesn't show it again. If the user kills the app mid-
// view (rare), the next launch will show it again — that's fine,
// once-per-update is the goal not once-ever.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { STORAGE_KEYS } from '../config/constants';
import { WHATS_NEW } from '../components/WhatsNewModal';

const currentVersion = () => Constants?.expoConfig?.version || '';

export function useWhatsNew() {
  const [version, setVersion] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = currentVersion();
        if (!v) return; // shouldn't happen but guard anyway
        const last = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SEEN_VERSION);

        if (!last) {
          // First-time install. Stamp current version silently so
          // future upgrades trigger the modal correctly.
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, v);
          return;
        }

        if (last === v) return; // same version, nothing to show

        // Version changed. Only surface the modal if we have copy for
        // this exact version — patch releases with no user-facing
        // change can skip by simply not having a WHATS_NEW entry.
        if (!WHATS_NEW[v]) {
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, v);
          return;
        }

        if (cancelled) return;
        setVersion(v);
        setVisible(true);
      } catch (e) {
        // Storage glitches shouldn't block the app booting.
        console.warn('[useWhatsNew] check failed:', e?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    try {
      const v = currentVersion();
      if (v) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, v);
      }
    } catch {
      // Best-effort persist; if it fails the modal will show once more
      // on next launch, which is harmless.
    }
  };

  return { visible, version, dismiss };
}
