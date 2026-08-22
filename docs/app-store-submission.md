# App Store Submission — Ascend: Daily Discipline

This file is a release checklist, not proof that dashboard work has been completed. Keep unchecked items unchecked until they are verified in App Store Connect or on a physical device.

## Current product facts

- App name: `Ascend: Daily Discipline`
- App version: `1.0.44`
- Bundle ID: `com.ascend.growth`
- App Store ID: `6761607644`
- Languages: Turkish and English
- Subscription products: `com.ascend.premium.monthly`, `com.ascend.premium.yearly`
- RevenueCat entitlement/offering: `premium` / `default`
- Hearts: free users start with 5; after the new-user grace period, hearts refill every 15 minutes

The canonical localized metadata is in `../mobile/APP_STORE_LISTING.md`. Reviewer notes are in `../mobile/APP_REVIEW_INFO.md`.

## Brand and metadata

- [ ] App name, subtitle, description, promotional text, IAP names, and screenshots consistently use “Ascend: Daily Discipline”.
- [ ] Turkish storefront assets contain Turkish UI only; English storefront assets contain English UI only.
- [ ] Current red-and-white app icon is used in the binary and store assets.
- [ ] Description accurately states a 15-minute heart refill interval.
- [ ] App version and “What’s New” match the selected build.

## Public URLs

Expected GitHub Pages URLs after Pages is enabled for this repository:

- Support: `https://berkdemirokk.github.io/ascend-mobile/`
- Privacy: `https://berkdemirokk.github.io/ascend-mobile/privacy.html`
- Terms: `https://berkdemirokk.github.io/ascend-mobile/terms.html`

- [ ] Each URL returns HTTP 200 without authentication.
- [ ] Each page displays “Ascend: Daily Discipline”.
- [ ] The exact verified URLs are entered in App Store Connect.

Do not replace working production URLs in App Store Connect until the new Pages deployment is live.

## App Privacy

Validate these declarations against the candidate binary and current SDK dashboards:

- [ ] Email address and user ID are disclosed for account/app functionality.
- [ ] Purchase history is disclosed for subscription functionality.
- [ ] Written reflections/user content are disclosed when cloud sync is enabled.
- [ ] Product interaction and diagnostics are disclosed where collected.
- [ ] Advertising identifiers and tracking use are disclosed for AdMob, subject to ATT.
- [ ] Optional raw voice-reflection audio is described as local-only if the candidate build still behaves that way.
- [ ] Location, contacts, photos, health, and financial data are not claimed as collected unless implementation changes.

## Subscriptions

- [ ] Monthly and yearly products are Ready to Submit or Approved in App Store Connect.
- [ ] Both products belong to the intended subscription group.
- [ ] RevenueCat `default` is current and maps both packages to the `premium` entitlement.
- [ ] Displayed prices are loaded from StoreKit; no hard-coded price is shown as the purchase price.
- [ ] Any trial wording exactly matches an active introductory offer.
- [ ] Restore Purchases works on a physical device with a sandbox/TestFlight account.

## Review access

Guest mode covers the main lesson flow. If account deletion and cloud sync require a review login:

- [ ] Create a dedicated verified review user in Supabase.
- [ ] Test the credentials immediately before submission.
- [ ] Store the credentials only in App Store Connect review fields or an approved secret manager; never commit them.
- [ ] Explain guest mode, subscriptions, restore, ATT, and account deletion in Reviewer Notes.

## Build and physical-device gate

From `mobile/`:

```bash
npm ci
npm run quality:ci
```

- [ ] Quality CI passes on the exact commit being submitted.
- [ ] The TestFlight workflow finishes build **and** submission successfully.
- [ ] The selected build shows version 1.0.44 and the intended remote build number.
- [ ] Fresh install/onboarding works in Turkish and English.
- [ ] First lesson, quiz, action, reflection, streak, XP, and 15-minute heart copy/behavior agree.
- [ ] Apple Sign-In and email authentication work.
- [ ] ATT is requested before personalized advertising initialization.
- [ ] Free-user ads and premium ad removal work.
- [ ] Purchase, cancellation messaging, and restore work.
- [ ] Account deletion removes the server user and clears local state.
- [ ] Privacy, terms, and support links open publicly.

## Submission

- [ ] Screenshots cover Today, paths, lesson/quiz, progress, settings, and paywall where appropriate.
- [ ] Accessibility support is declared only after verification on the candidate build.
- [ ] Age rating and categories match the current App Store questionnaire.
- [ ] Correct build and in-app purchases are attached to the version.
- [ ] All automated and manual gates above are recorded as passed before Submit for Review.
