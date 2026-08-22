# Security best-practices report

Audit date: 2026-08-22  
Scope: Expo mobile app, GitHub Actions, public legal/support pages, Supabase database policies, and Edge Functions.

## Summary

No unresolved critical or high-severity code findings remain. The production database policy and both deployed Edge Functions were verified after remediation. `npm audit` reports zero vulnerabilities and the full mobile release gate passes.

One platform-level warning remains: Supabase leaked-password protection is unavailable on the project's Free plan. New and reset passwords now require at least eight characters as a plan-independent mitigation. Enabling breached-password detection requires a Supabase Pro-plan upgrade.

## Findings

### SEC-001 — Cross-squad membership disclosure — High — Resolved

The previous authenticated read policy exposed all `squad_members` rows to any signed-in user. Migration `mobile/supabase/migrations/20260822101925_restrict_squad_member_reads.sql:10` adds a private, security-definer authorization helper; lines 34–36 limit execution to authenticated users; lines 38–43 replace the broad policy with participant/owner-scoped access. The migration was applied to production and the installed policy was queried afterward.

### SEC-002 — Mutable CI action references — High — Resolved

GitHub Actions were changed from mutable tags to reviewed 40-character commit SHAs, including `.github/workflows/deploy-functions.yml:38`, `.github/workflows/expo-testflight.yml:32`, and `.github/workflows/pages.yml:28`. `mobile/scripts/quality_static.js:545` prevents mutable action references from returning.

### SEC-003 — Vulnerable transitive dependency chain — High — Resolved

The app was upgraded to Expo SDK 57 and React Native 0.86.2. `@supabase/supabase-js` and Material Icons are pinned to reviewed exact versions in `mobile/package.json`. The current production dependency audit reports zero vulnerabilities.

### SEC-004 — Edge Function dependency and request hardening — High — Resolved

Both functions pin `@supabase/supabase-js@2.112.3` (`mobile/supabase/functions/delete-user/index.ts:23` and `mobile/supabase/functions/broadcast-push/index.ts:38`). Broadcast authorization uses constant-time SHA-256 comparison at lines 197–198 and limits request size/title/body at lines 49–51 and 82–98. Hosted unauthenticated probes return HTTP 401. Deployed versions are `delete-user` v4 and `broadcast-push` v3.

### SEC-005 — Public-page browser protections absent — Medium — Resolved

All six public HTML pages now declare a restrictive Content Security Policy and `no-referrer`; for example `docs/index.html:6–7`. Static checks at `mobile/scripts/quality_static.js:552` enforce this across every page.

### SEC-006 — Weak new-password minimum — Medium — Resolved with plan limitation

Signup and password reset now require eight characters at `mobile/src/screens/auth/SignupScreen.js:40` and `mobile/src/screens/auth/ResetPasswordScreen.js:154`. Login deliberately accepts legacy credentials so existing users are not locked out (`mobile/src/screens/auth/LoginScreen.js:40`). Regression guards are at `mobile/scripts/quality_static.js:1007–1013`.

Supabase's breached-password database check remains disabled because the organization is on the Free plan and the feature requires Pro or above. This is a platform/account limitation, not an unpatched code path.

## Verification

- Static release/security assertions: pass.
- Runtime regression tests: pass.
- Expo Doctor: all checks pass.
- iOS production export: pass.
- Production dependency audit: zero vulnerabilities.
- Workflow YAML validation: pass.
- Supabase RLS policy inspection and hosted Edge Function authorization probes: pass.

