# GitHub TestFlight Setup

The canonical iOS release is the Expo application under `mobile/`. GitHub
Actions validates the candidate, creates an EAS cloud build, and submits that
build to TestFlight.

## Required GitHub repository secrets

- `EXPO_TOKEN`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `APPLE_TEAM_ID`

EAS manages signing credentials remotely. Do not add distribution certificates,
provisioning profiles, `.p8` files, or temporary keychains to the repository.

## Workflow

The release workflow is `.github/workflows/expo-testflight.yml`.

- A `mobile-vX.Y.Z` tag builds and submits a new candidate.
- Manual dispatch without a build ID builds and submits a new candidate.
- Manual dispatch with an existing EAS iOS build ID submits that build.
- `npm run quality:ci` must pass before build or submission.
- The App Store Connect key is written only to the runner's temporary directory.

The production build runs on EAS Cloud using the image pinned in
`mobile/eas.json`. A successful EAS build is not proof of TestFlight delivery;
the submit step must also complete successfully.

## Public pages and backend functions

- `.github/workflows/pages.yml` deploys `docs/` to GitHub Pages.
- `.github/workflows/deploy-functions.yml` deploys the reviewed Supabase Edge
  Functions and verifies that unauthenticated calls are rejected.

## Identifiers

- Bundle ID: `com.ascend.growth`
- App Store ID: `6761607644`
- EAS project ID: `2a44eced-27a4-4ae2-b831-25957422f01b`
