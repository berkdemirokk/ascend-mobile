# Ascend: Daily Discipline — Design System

This document describes the current red-and-white product identity. Runtime tokens in `src/config/lightTheme.js` remain the implementation source of truth.

## Brand direction

Ascend should feel focused, energetic, and approachable. The identity uses a vivid red upward/meditation mark on clean neutral surfaces. Avoid all retired dark-cosmic, metallic-flame, glassmorphism, and character-mascot directions.

The product name is always **Ascend: Daily Discipline** in customer-facing copy. Do not reuse earlier product names or visual themes.

## Color tokens

### Light theme — current production baseline

- Background and surface: `#F9F9F9`
- Lowest/elevated card surface: `#FFFFFF`
- Muted containers: `#F3F3F4`, `#EEEEEE`, `#E8E8E8`, `#E2E2E2`
- Primary text: `#1A1C1C`
- Secondary text: `#5E3F3A`
- Primary red: `#B70006`
- Strong red container: `#E31212`
- Text on red: `#FFFFFF`
- Optional cobalt accent: `#3741E1`
- Success: `#0F7B3D`
- Error: `#BA1A1A`

Red is reserved for primary actions, active progress, and the core brand mark. Cobalt is an occasional supporting accent, not a competing brand color.

### Dark-theme status

Dark tokens exist as a foundation, but most screens still use static light tokens. Do not present dark mode as complete until every screen has passed contrast and real-device review. New UI work must not create a mixed light/dark screen.

## Typography

Use Inter throughout the app.

- Hero: 64/70, weight 900
- H1: 32/38, weight 700
- H2: 24/31, weight 700
- Large body: 18/28, weight 500
- Medium body: 16/24, weight 500
- Body: 14/21, weight 400
- Uppercase label: 12/12, weight 700, 2px tracking
- Streak number: 48/48, weight 900

Keep copy direct and readable. Do not use uppercase for paragraphs or long labels.

## Spacing and shape

- Base spacing: 4px
- Common steps: 8, 16, 24, 32, 48px
- Screen gutter: 16px
- Page margin: 20px
- Corner radii: 4, 8, 12, 16px; use pill radius only for chips and compact controls

Cards use clean neutral layers and restrained borders or shadows. Avoid decorative glow, frosted-glass effects, and unnecessary gradients.

## Components

### Buttons

- Primary: solid brand red, white label, strong contrast
- Secondary: neutral surface with a clear border and dark label
- Destructive: error red and explicit destructive wording
- Disabled: visibly muted while keeping the label legible

Every interactive control needs an accessible label, a predictable pressed state, and at least a 44×44pt touch target.

### Cards and progress

- Use white or neutral containers against the light background.
- Show hierarchy through spacing, typography, and restrained elevation.
- Use red for current progress and primary completion states.
- Do not rely on color alone; pair state colors with text, icons, or shape changes.

### Inputs

- Provide persistent labels or clear accessible names.
- Use neutral filled or outlined fields with visible focus and error states.
- Keep validation messages next to the affected field.

## Logo and imagery

Use the current red-and-white Ascend icon supplied in `assets/`. Do not substitute earlier flame, celestial, or character artwork. Store screenshots, support pages, social assets, and paywalls must use the same identity.

## Localization and accessibility

- A single screenshot or screen must not mix Turkish and English UI copy.
- Test Turkish and English separately, including truncation and Dynamic Type.
- Maintain WCAG-readable contrast and support screen-reader labels and logical focus order.
- App Store accessibility declarations must match features verified in the shipping build.

## Review checklist

- [ ] Product name is “Ascend: Daily Discipline”.
- [ ] Current red-and-white icon is used.
- [ ] No retired visual direction or character artwork remains.
- [ ] Each localized screen uses one language consistently.
- [ ] Text, controls, and status messages pass contrast and touch-target checks.
- [ ] Light and dark appearance are each reviewed on a real device before claiming support.
