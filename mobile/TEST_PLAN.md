# Test Plan - Ascend: Daily Discipline

Walk through this on a real iPhone via TestFlight before submitting a new App Store build.

Total time: about 25-35 minutes.

Record the exact commit, EAS build ID, app version/build number, device model, iOS version, tester and date before starting. Retain a short screen recording and crash/hang logs for failed cases. JS export and source checks do not substitute for these device results.

## 1. Cold Start

| Step | Expected |
| --- | --- |
| Fresh install, online launch | First usable screen appears; no indefinite blank screen |
| Fresh install, offline launch | Guest flow is usable after bounded startup loading |
| Upgrade an existing installation | Progress is preserved; first usable screen appears |
| Force-quit the app | App is removed from the app switcher |
| Turn on Airplane Mode | Device is offline |
| Open Ascend | Splash resolves; app does not hang forever |
| Turn off Airplane Mode | Network-backed features recover |
| Open a password-reset deep link | Reset password route opens correctly |
| Relaunch without any deep link | Navigation renders normally |

Pass: offline launch does not freeze on auth/session loading.

For a failure, record the timestamp, whether the process remains alive, and the first screen/error shown. Collect the iOS crash or hang report and startup logs. Missing analytics alone cannot distinguish native crash from an early JavaScript exception or an event that never flushed.

## 2. Welcome And Auth

| Step | Expected |
| --- | --- |
| Fresh install | Welcome screen shows Daily Discipline branding |
| Tap Continue as guest | Onboarding opens |
| Return and test email signup/login if needed | Errors are shown clearly |
| Test Apple Sign-In on iOS | Native Apple sheet appears; cancel is graceful |

Pass: user can enter the app without being forced to create an account.

## 3. Onboarding

| Step | Expected |
| --- | --- |
| Continue through personalization | Goal/time/mood are optional |
| Pick a path | Selected path is highlighted |
| Pick an archetype | Selection persists |
| Enable VoiceOver and change each choice | Goal, time, mood, path and archetype announce their label and checked state |
| Use largest text size on a small phone and iPad | Cards grow to fit text; controls remain reachable without clipping |
| Enter a name with the keyboard open | Fields and Continue remain reachable; dismissing keyboard is reliable |
| Skip the upsell | Onboarding completes and lesson 1 opens directly |
| Permission prompts | Notification/ATT prompts may appear after onboarding; app still works if denied |

Pass: time-to-first-lesson stays short and no mandatory form blocks progress.

## 4. First Lesson

| Step | Expected |
| --- | --- |
| Read lesson pages | Teaching text is paginated and readable |
| Use Listen button | Native TTS starts/stops |
| Answer quiz | Correct/wrong feedback is clear |
| New install wrong answer | 24-hour grace prevents immediate heart loss |
| Complete lesson | Celebration appears and progress is saved |

Pass: lesson_started and lesson_completed should appear in Supabase analytics if the analytics table exists.

## 5. Paywall And Purchase

| Step | Expected |
| --- | --- |
| Open Settings -> Premium Status | Paywall opens with source settings_premium_status |
| Verify packages | Monthly/yearly prices load from StoreKit |
| Tap purchase then cancel | No error alert; purchase_cancelled event is logged |
| Complete sandbox purchase if available | Premium unlocks, ads/hearts restrictions are removed |
| Tap Restore Purchases | Success, empty, or failure state gives clear feedback |

Pass: paywall_shown, paywall_cta_tap, purchase_started, and final purchase/restore result events are logged.

## 6. Locked Lessons And Hearts

| Step | Expected |
| --- | --- |
| Tap a premium-locked lesson | Paywall opens with source path_locked_lesson |
| Use an older test account outside grace period | Wrong answers consume hearts |
| Reach 0 hearts and start a lesson | Out-of-hearts modal appears |
| Tap Premium from modal | Paywall opens with the relevant out_of_hearts source |

Pass: no dead buttons; every blocked path has a clear next action.

## 7. Settings, Legal, And Account Delete

| Step | Expected |
| --- | --- |
| Open Privacy and Terms | Links open in browser |
| Toggle notifications/sounds/haptics | Controls persist |
| Restore purchases from Settings | Clear result alert |
| Delete account while signed in | Server deletion succeeds, local data clears, user signs out |

Pass: account deletion meets App Store 5.1.1(v).

## 8. Final Submission Check

- App name in binary: Ascend: Daily Discipline.
- App Store Connect name: Ascend: Daily Discipline.
- Languages: Turkish and English only.
- RevenueCat products: com.ascend.premium.monthly and com.ascend.premium.yearly.
- AdMob release units are real units; test units are not forced in release.
- `npm run quality:ci` passes before tagging/submitting.
