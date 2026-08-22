# Ascend: Daily Discipline v1.0.44 — Submission Checklist

This checklist records release evidence. An unchecked box means “not yet verified”; it does not mean the feature is absent. Do not pre-check dashboard or physical-device work.

## 1. Candidate build

- [ ] Candidate commit is identified and the working tree is clean.
- [ ] `npm ci` succeeds.
- [ ] `npm run quality:ci` succeeds, including Expo Doctor and the critical dependency audit.
- [ ] iOS export succeeds for the same commit.
- [ ] GitHub Actions completes both EAS build and TestFlight submission without cancellation.
- [ ] TestFlight displays app version `1.0.44` and the expected remote build number.
- [ ] App Review contact includes a verified phone number in App Store Connect.

## 2. App Store Connect

- [ ] Product name is `Ascend: Daily Discipline` in both localizations.
- [ ] Metadata is copied from `APP_STORE_LISTING.md` and reviewed for language consistency.
- [ ] Current red-and-white icon is used.
- [ ] Turkish screenshots contain Turkish UI only.
- [ ] English screenshots contain English UI only.
- [ ] Monthly and yearly subscriptions are attached to the version and ready for review.
- [ ] Trial wording matches the active introductory offer exactly.
- [ ] Privacy Nutrition Labels match the candidate binary and third-party SDK configuration.
- [ ] Accessibility declarations include only features verified in the candidate build.

## 3. Public pages

Expected URLs after GitHub Pages is deployed from this repository:

- Support: `https://berkdemirokk.github.io/ascend-mobile/`
- Privacy: `https://berkdemirokk.github.io/ascend-mobile/privacy.html`
- Terms: `https://berkdemirokk.github.io/ascend-mobile/terms.html`

- [ ] All three URLs return HTTP 200 without login.
- [ ] All three pages use the current product name.
- [ ] Verified URLs are entered in App Store Connect.

Keep existing production URLs in App Store Connect until the replacement Pages deployment is confirmed live.

## 4. RevenueCat and StoreKit

- [ ] `com.ascend.premium.monthly` is available.
- [ ] `com.ascend.premium.yearly` is available.
- [ ] RevenueCat entitlement `premium` contains both products.
- [ ] RevenueCat offering `default` is current and exposes monthly/yearly packages.
- [ ] Paywall displays localized StoreKit prices.
- [ ] Purchase and Restore Purchases succeed in sandbox/TestFlight.
- [ ] Premium removes ads and unlocks the promised benefits.

## 5. Backend and authentication

- [ ] Supabase migrations required by the candidate are deployed.
- [ ] `delete-user` Edge Function is deployed and authenticated calls succeed.
- [ ] Apple Sign-In creates or restores the expected Supabase user.
- [ ] Email sign-up/sign-in works.
- [ ] Account deletion removes the Supabase user and clears local state.

Never put service-role keys, App Store private keys, passwords, or review credentials in this file.

## 6. Physical iPhone regression

Use `TEST_PLAN_v1.0.44.md` and record device model, iOS version, build number, tester, date, and result.

- [ ] Fresh install and onboarding pass in Turkish.
- [ ] Fresh install and onboarding pass in English.
- [ ] First lesson, quiz, action, reflection, streak, XP, and progress pass.
- [ ] Hearts begin at 5 and the post-grace refill behavior matches the 15-minute product copy.
- [ ] Notification and ATT prompts appear at the intended moments.
- [ ] Free ads and premium ad removal behave correctly.
- [ ] Paywall, purchase, cancellation messaging, and restore pass.
- [ ] Offline launch fails gracefully.
- [ ] Privacy, terms, and support links open.
- [ ] Voice reflection remains local-only if that disclosure is used.
- [ ] Light appearance is visually complete; dark appearance is not claimed until every screen passes review.

## 7. Reviewer information and submit

- [ ] Reviewer Notes are copied from `APP_REVIEW_INFO.md` and updated for the candidate.
- [ ] Guest access is explained.
- [ ] If a review account is needed, a dedicated verified account is created and tested.
- [ ] Review credentials are entered directly in App Store Connect, never committed.
- [ ] Correct build and in-app purchases are selected.
- [ ] All required metadata sections show complete.
- [ ] Final submit is performed only after every applicable gate above has evidence.
