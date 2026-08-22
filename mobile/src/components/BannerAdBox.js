// BannerAdBox — renders an AdMob banner for free users only.
// Lazy-loads react-native-google-mobile-ads so the bundle still works without it.
//
// Defensive against AdMob no-fill: hides the wrapper entirely when no ad
// loads, instead of leaving an 8px empty band at the bottom of the screen.
// New AdMob accounts often have near-zero fill for the first 24-72h, and
// this avoids the "broken UI" look during that window.

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useApp } from '../contexts/AppContext';
import {
  getBannerId,
  isAdsReady,
  requestNonPersonalizedAdsOnly,
} from '../services/ads';

export default function BannerAdBox() {
  const { isPremium } = useApp();
  const [BannerAd, setBannerAd] = useState(null);
  const [BannerAdSize, setBannerAdSize] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isPremium) return;
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-google-mobile-ads');
        if (!mounted) return;
        setBannerAd(() => mod.BannerAd);
        setBannerAdSize(mod.BannerAdSize);
      } catch {
        // module not available — skip banner silently
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isPremium]);

  if (isPremium || !BannerAd || !BannerAdSize || !isAdsReady()) return null;
  const adId = getBannerId();
  if (!adId) return null;

  return (
    <View style={[styles.wrap, !loaded && styles.wrapHidden]}>
      <BannerAd
        unitId={adId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          // Mirrors interstitial/rewarded — personalized only when ATT
          // explicitly granted. Apple Review will check that no
          // personalized request fires before consent.
          requestNonPersonalizedAdsOnly: requestNonPersonalizedAdsOnly(),
        }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderTopWidth: 1,
    borderTopColor: '#E8BCB6',
    paddingVertical: 4,
  },
  // While the ad hasn't loaded yet (or failed permanently), collapse the
  // wrapper so the user doesn't see an empty bar.
  wrapHidden: {
    height: 0,
    paddingVertical: 0,
    borderTopWidth: 0,
    overflow: 'hidden',
  },
});
