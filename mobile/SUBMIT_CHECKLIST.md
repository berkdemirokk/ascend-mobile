# Ascend: Daily Discipline — Release Checklist

Use this checklist for the candidate being submitted. The marketing version comes from `app.json`; the build number comes from EAS because `appVersionSource` is remote. Never reuse an earlier build's checked boxes.

## Candidate evidence

- Candidate commit: **not recorded yet**
- EAS build ID, marketing version, and build number: **not recorded yet**
- App Store Connect processing status: **not verified**
- Device model / iOS / tester / date: **not recorded yet**
- Startup result: **not verified on a physical device**

Historical upload: version 1.0.46, build 131, EAS `4da9dcdc-608e-4bce-90aa-dc4f5da3bbec`, workflow <https://github.com/berkdemirokk/ascend-mobile/actions/runs/40206726605>. Its upload is not evidence that the newer candidate launches. A white-screen/startup failure was reported in this release investigation.

## Automated gates

- [ ] Record the exact source commit and confirm a clean checkout.
- [ ] Run `npm ci` and `npm run quality:ci` at that commit; retain the output.
- [ ] Review every remaining dependency advisory and its disposition.
- [ ] Verify EAS metadata matches the checkout SHA, project, production profile, iOS store target, finished status, and marketing version. `expo-testflight.yml` runs `scripts/verify_eas_build.js` before either submission path.
- [ ] Record EAS's remote build number and submission ID.
- [ ] Run Verify App Store Connect with that exact `expected_build`. A missing, processing, invalid, or expired build must not be called verified.

A green JS export, mocked test suite, or EAS build does not prove the production IPA launches. The Windows workspace cannot run Xcode/iOS simulators.

## Physical device gate

Follow `TEST_PLAN.md`. Attach logs and evidence to the release record, not only a pass/fail statement.

- [ ] Fresh install opens the first usable screen online; no indefinite blank/loading screen.
- [ ] Fresh install opens offline and offers a usable guest path.
- [ ] Upgrade from the previous build retains progress and opens online and offline.
- [ ] Force-quit/relaunch succeeds repeatedly; background/foreground resumes safely.
- [ ] Password-reset link opens the intended screen; normal launch does not depend on a deep link.
- [ ] Complete onboarding and first lesson in Turkish and English, including quiz, reflection, XP, streak, and progress.
- [ ] Test small-screen and iPad layouts, largest supported text size, keyboard, VoiceOver selection announcements, and denied permissions.
- [ ] Test paywall prices, cancellation, sandbox purchase, restore, and premium benefits on the same binary.
- [ ] Test notification taps, voice reflection, offline recovery, and legal/support links.

If launch fails, record build/OS, timestamp, screen behavior and crash/hang logs. Missing analytics is not proof of a native crash: startup can fail before telemetry initializes or before queued events flush. Do not promote the candidate to App Review or broader distribution while startup is failing.

## Backend and privacy gate

- [ ] Confirm the configured Supabase project is active and reachable.
- [ ] Verify deployed migration history and actual columns against the client writes.
- [ ] Verify owner-only state/reflections, referral RPC transitions, and unauthorized access denial.
- [ ] Verify email and Apple authentication, password reset, account switching, cloud restore, and account deletion.
- [ ] Confirm authenticated `delete-user` deployment and deletion of the test account's data.
- [ ] Confirm voice privacy disclosures match storage behavior and App Store privacy declarations match the binary.

## Store review gate

- [ ] Verify current branding, English/Turkish metadata and screenshots, reviewer contact details, and support/privacy/terms URLs.
- [ ] Verify RevenueCat products, entitlement, current offering, StoreKit prices, and actual introductory-offer eligibility.
- [ ] Select the verified build and required in-app purchases in App Store Connect.
- [ ] Record reviewer notes for this build; enter any review credentials directly in App Store Connect, never in Git.
- [ ] Submit for App Review only after every applicable gate above has evidence.

Earlier 1.0.44/build125 checklist evidence is historical and does not validate this candidate.
