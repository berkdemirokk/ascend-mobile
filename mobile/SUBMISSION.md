# Submission Notes

This file intentionally stays short. Older versions of this document contained stale Arabic localization, old product IDs, and outdated monetization notes. Use the files below as the current source of truth:

- `SUBMIT_CHECKLIST.md`
- `APP_REVIEW_INFO.md`
- `APP_STORE_LISTING.md`
- `../docs/app-store-submission.md`
- `../docs/privacy.html`
- `../docs/terms.html`
- `../docs/support.html`

Current runtime facts:

- App name: `Ascend: Daily Discipline`
- Bundle ID: `com.ascend.growth`
- App Store ID: `6761607644`
- iOS build version in `app.json`: `1.0.42`
- iOS build number: managed remotely by EAS with production auto-increment
- Languages enabled in app: Turkish and English
- Arabic/RTL: not enabled for v1
- Subscriptions:
  - `com.ascend.premium.monthly`
  - `com.ascend.premium.yearly`
- RevenueCat entitlement: `premium`
- RevenueCat offering: `default`
- AdMob iOS app ID: `ca-app-pub-9898903071826160~2513505932`
- AdMob iOS units:
  - Interstitial: `ca-app-pub-9898903071826160/5475177787`
  - Rewarded: `ca-app-pub-9898903071826160/5610075008`
  - Banner: `ca-app-pub-9898903071826160/8236238348`

Before every TestFlight/App Store submission:

```bash
npm ci
npm run quality:ci
```

Manual checks still required on a real iPhone:

- Fresh install and onboarding
- First lesson completion
- ATT prompt timing
- Paywall pricing and restore purchases
- Apple Sign-In
- Account deletion
- Ads for free users
- Premium removes ads
- Privacy, terms, and support links open publicly
