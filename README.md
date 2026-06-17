# Ascend: Monk Mode

A Duolingo-style discipline learning app for iOS — 5 paths × 50 lessons each (250 total) to build "monk mode" habits in 50 days.

**Status**: TestFlight beta, App Store submission in progress.

---

## Stack

- **App**: React Native + Expo SDK 52 (`mobile/`)
- **Backend / Auth**: Supabase (auth + cloud sync)
- **Subscriptions**: RevenueCat + StoreKit (in-app purchases)
- **Ads**: AdMob (banner + interstitial + rewarded)
- **Build**: EAS Build via GitHub Actions → TestFlight
- **i18n**: TR / EN

## Project Structure

```
ascend-ai-growth-coach/
├── mobile/              # Expo iOS app (active)
│   ├── src/
│   │   ├── screens/     # Path, lesson, profile, settings, auth, reports
│   │   ├── components/  # Shared UI and modals
│   │   ├── services/    # ads, purchases, supabase, sounds, notifications
│   │   ├── contexts/    # AppContext, AuthContext
│   │   ├── i18n/        # locales/{tr,en}.json + lessons.{tr,en}.json
│   │   ├── data/        # paths and assessment data
│   │   └── config/      # constants, achievements, ranks, paywallVariants
│   ├── scripts/         # ASC + RC config + content seeders
│   ├── credentials/     # .p8 keys (gitignored)
│   ├── DESIGN.md        # Design system manifest
│   ├── MARKETING_KIT.md # Ad campaign brief
│   └── APP_PREVIEW_GUIDE.md
├── docs/                # GitHub Pages (privacy, terms, submission notes)
└── .github/workflows/   # expo-testflight.yml (build + upload pipeline)
```

## Content

- **5 paths**: Dopamine Detox, Silent Morning, Mind/Body/Money Discipline
- **50 lessons each** = 250 total
- **2 quiz questions per lesson** = 1000 quiz questions
- **2 languages**: TR + EN parallel. Arabic is not enabled in-app until the curriculum is fully translated.

## Build & Deploy

CI/CD via GitHub Actions:
- Push tag `mobile-vX.Y.Z` → triggers `expo-testflight.yml`
- Builds iOS .ipa via EAS Build local on macOS runner
- Runs Expo Doctor, iOS export, and critical npm audit before the EAS build
- Uploads to TestFlight with the App Store Connect API key

Required GitHub secrets:
- `EXPO_TOKEN`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY` (.p8 contents)
- `APPLE_TEAM_ID`
- `KEYCHAIN_PASSWORD`, `P12_PASSWORD`, `BUILD_CERTIFICATE_BASE64`, `BUILD_PROVISION_PROFILE_BASE64`
- `REVENUECAT_SECRET_API_KEY`

## Local Dev

```bash
cd mobile
npm install
npx expo start
```

Test on physical device via Expo Go (limited — most native modules require dev client).

## Configuration Scripts

```bash
cd mobile

# Verify App Store Connect state
python scripts/verify_asc.py

# Configure RevenueCat (entitlement + offering + packages)
python scripts/configure_revenuecat.py

# Seed lesson content (idempotent)
node scripts/seed_silent_morning.js
node scripts/seed_mind_31_50.js
# ...
```

## Key Documents

- `mobile/DESIGN.md` — official design system tokens (M3 dark theme)
- `mobile/MARKETING_KIT.md` — full ad campaign brief
- `mobile/APP_PREVIEW_GUIDE.md` — App Store preview video production guide
- `docs/app-store-submission.md` — submission checklist
- `docs/privacy.html` — privacy policy (GitHub Pages)
- `docs/terms.html` — terms of service (GitHub Pages)

## Bundle ID & App Identifiers

- **iOS Bundle ID**: `com.ascend.growth`
- **Apple Team ID**: `44B88YK392`
- **App Store ID**: `6761607644`
- **iOS subscriptions**: `com.ascend.premium.monthly`, `com.ascend.premium.yearly`
