# Ascend: Monk Mode

An Expo iOS app for discipline training: 5 paths, 50 lessons each, streaks, hearts, achievements, subscriptions, ads, Supabase auth/cloud sync, and TR/EN localization.

---

## Status

TestFlight beta. App Store submission work is tracked in `SUBMIT_CHECKLIST.md`, `APP_REVIEW_INFO.md`, and `../docs/app-store-submission.md`.

---

## Tech Stack

- **Expo 52** — managed workflow, OTA updates
- **React Native** — cross-platform mobile UI
- **React Navigation 6** — stack + bottom-tab navigation
- **RevenueCat** — in-app subscriptions and purchase management
- **Supabase** — auth, progress cloud sync, edge functions
- **AdMob** — banner, interstitial, and rewarded ads for free users
- **AsyncStorage** — local persistence for preferences, progress, and local-only voice recordings

---

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator (Android Studio)
- An Expo account (`expo login`)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/berkdemirokk/ascend-mobile.git

# 2. Navigate to the mobile app directory
cd ascend-mobile/mobile

# 3. Install dependencies
npm install

# 4. Start the development server
npm run start
```

Most native modules require a development build or TestFlight build. Expo Go is useful only for limited UI checks.

---

## Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

**.env.example**

```env
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_revenuecat_ios_key
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_revenuecat_android_key
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> Never commit your `.env` file. It is listed in `.gitignore`.

---

## Building for Production

### Configure EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
```

### iOS Build

```bash
eas build --platform ios
```

### Release Checks

```bash
npm run quality:ci
```

This runs Expo Doctor, an iOS export, and a critical-level production dependency audit.

### Android Build

```bash
eas build --platform android
```

Build artifacts are hosted on the Expo dashboard and can be downloaded for submission.

---

## App Store Submission

1. **Apple App Store**
   - Run `eas build --platform ios --profile production`
   - Download the `.ipa` from the Expo dashboard
   - Open Transporter (macOS) or use `eas submit --platform ios`
   - Complete the App Store Connect listing (screenshots, description, privacy details)
   - Submit for review

2. **Google Play Store**
   - Run `eas build --platform android --profile production`
   - Download the `.aab` from the Expo dashboard
   - Upload to the Google Play Console under a new release
   - Complete the store listing and content rating questionnaire
   - Submit for review

---

## Project Structure

```
mobile/
├── assets/                  # Images, fonts, and static assets
├── src/
│   ├── components/          # Shared UI components
│   ├── config/
│   │   └── constants.js     # App-wide constants (CATEGORIES, DIFFICULTIES, etc.)
│   ├── contexts/
│   │   └── AppContext.js    # Global state via React Context
│   ├── navigation/
│   │   └── AppNavigator.js  # Root stack + bottom tab navigator
│   ├── screens/
│   │   ├── HomeScreen.js
│   │   ├── HistoryScreen.js
│   │   ├── OnboardingScreen.js
│   │   ├── PaywallScreen.js
│   │   ├── ProfileScreen.js
│   │   └── SettingsScreen.js
│   └── services/
│       └── purchases.js     # RevenueCat purchase helpers
├── .env.example
├── app.json                 # Expo configuration
├── eas.json                 # EAS Build profiles
├── package.json
└── README.md
```

---

## License

MIT License. See [LICENSE](../LICENSE) for details.
