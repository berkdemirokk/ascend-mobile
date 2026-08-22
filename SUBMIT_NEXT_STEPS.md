# Ascend: Daily Discipline — Manual Release Steps

These are account/dashboard and physical-device tasks that cannot be proven by repository state. Do them in order and record evidence in `mobile/SUBMIT_CHECKLIST.md`.

## 1. Deploy and verify Supabase

From the repository root:

```bash
cd mobile
supabase link --project-ref wihkcmgtzmdupxuyavyr
supabase functions deploy delete-user --no-verify-jwt
supabase functions deploy broadcast-push --no-verify-jwt
```

- Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions. Configure only `BROADCAST_SECRET` for `broadcast-push`; never paste it into this repository.
- Apply the reviewed schema/migrations using the project’s established deployment process.
- Verify email authentication, Apple Sign-In, cloud sync, and account deletion with disposable test users.

## 2. Verify App Store Connect and RevenueCat

- Confirm `com.ascend.premium.monthly` and `com.ascend.premium.yearly` exist in the intended subscription group.
- Confirm RevenueCat entitlement `premium` contains both products.
- Confirm offering `default` is current and includes monthly/yearly packages.
- Confirm any trial copy exactly matches active App Store introductory offers.
- Use sandbox/TestFlight to verify localized prices, purchase, entitlement activation, and restore.

## 3. Publish and verify public pages

Enable GitHub Pages from this repository’s `docs/` directory. Expected URLs are:

- `https://berkdemirokk.github.io/ascend-mobile/`
- `https://berkdemirokk.github.io/ascend-mobile/privacy.html`
- `https://berkdemirokk.github.io/ascend-mobile/terms.html`

Verify HTTP 200 and the “Ascend: Daily Discipline” title before replacing any working production URL in App Store Connect.

## 4. Produce the candidate build

```bash
cd mobile
npm ci
npm run quality:ci
```

Push the reviewed commit through the current `expo-testflight.yml` workflow. Do not assume a build is released merely because EAS build succeeded: the TestFlight submission step must also complete.

## 5. Run the physical-device plan

Install the candidate from TestFlight on a real iPhone and complete `mobile/TEST_PLAN_v1.0.44.md` in both Turkish and English.

Required coverage includes onboarding, lessons, quiz feedback, 15-minute heart refill behavior, notifications, ATT, ads, subscriptions, restore, Apple Sign-In, email auth, cloud sync, account deletion, public legal links, offline launch, and accessibility basics.

## 6. Prepare store assets and metadata

- Use the current red-and-white app icon.
- Use `mobile/APP_STORE_LISTING.md` as the metadata source of truth.
- Do not mix Turkish and English within one localized screenshot set.
- Include representative Today, path, lesson/quiz, progress, settings, and paywall screens.
- Complete App Privacy and accessibility declarations from verified candidate behavior.

## 7. Reviewer access and submission

Guest mode supports the main flow. If review requires authenticated deletion/cloud-sync testing, create a dedicated verified Supabase review user and enter its credentials directly in App Store Connect. Never save those credentials in Git.

Select the verified candidate build, attach the correct subscriptions, review all metadata one last time, and submit only when every applicable item in `mobile/SUBMIT_CHECKLIST.md` has evidence.
