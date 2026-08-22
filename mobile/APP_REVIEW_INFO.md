# Ascend: Daily Discipline - App Review Information

Use this for App Store Connect review notes for app version 1.0.44.

## Sign-In Info

Ascend supports "Continue as guest", so sign-in is not required for the main product flow. If App Review needs to test account deletion and cloud sync, create and verify a dedicated review account in Supabase, then enter its credentials directly in App Store Connect. Never commit review credentials to this repository.

## Notes For Reviewer

```
Ascend: Daily Discipline is a daily discipline-training app with short lessons, quizzes, streaks, hearts, and optional subscriptions.

KEY FLOWS TO TEST
1. Welcome screen: continue with Apple, email, or guest mode.
2. Onboarding: answer the quick personalization questions, pick a path, pick an archetype, then skip or open the Premium offer.
3. First lesson: after onboarding, the app opens lesson 1 directly. Complete teaching -> quiz -> action commitment -> optional reflection.
4. Hearts: free users have 5 hearts. New installs have a 24-hour grace period where wrong answers do not consume hearts. After the grace period, wrong quiz answers consume hearts and the full set refills 15 minutes after the first loss.
5. Paywall: open from Settings -> Premium Status, a locked lesson, the post-lesson trigger, or a heart-limit modal. Monthly and yearly subscription prices are loaded from StoreKit via RevenueCat. The paywall includes auto-renewal disclosure, restore, privacy policy, and terms links. Trial/introductory-offer wording is shown only when it matches the active StoreKit offer for the reviewer account.
6. Restore purchases: available both on the paywall and in Settings.
7. Account deletion: Settings -> Danger Zone -> Delete Account. This invokes the Supabase delete-user Edge Function, removes server state by cascade, clears local data, unlinks RevenueCat, and signs the user out.

PRIVACY / TRACKING
- The app asks for notification permission and ATT after onboarding, at a meaningful point before ads are initialized.
- If ATT is denied, the app still works and requests non-personalized ads.
- Voice reflections are optional. Raw audio files stay local on device and are not synced to Supabase.
- Written progress, written reflections, streaks, XP, and subscription state can sync through Supabase/RevenueCat when the user is signed in.

THIRD-PARTY SDKs
- Supabase: auth, cloud sync, analytics events, account deletion Edge Function.
- RevenueCat: in-app subscription management for com.ascend.premium.monthly and com.ascend.premium.yearly.
- Google AdMob: banner, interstitial, rewarded ads for free users.
- Apple Sign-In via expo-apple-authentication.

LANGUAGES
- Turkish and English are supported.
- Arabic/RTL is not enabled in this build.
```

## Contact

```
First name: Berk
Last name: Demirok
Email: berkdemirok@icloud.com
Phone: Enter the verified reviewer contact phone directly in App Store Connect; do not commit it.
```
