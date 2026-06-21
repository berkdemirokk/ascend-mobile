---
name: Ascend Daily Discipline
colors:
  surface: '#13131b'
  surface-dim: '#13131b'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#303038'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '900'
    lineHeight: '1.1'
    letterSpacing: 0
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: 0
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-page: 20px
  gutter-card: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style
The design system is engineered to evoke a sense of "digital stoicism" and cosmic focus. Targeted at high-performers and discipline-seekers, the visual language balances the vastness of space with the precision of modern technology.

The aesthetic follows a **High-Contrast Modern** direction with **Glassmorphism** and **Tactile** accents. It utilizes a "Deep Space" canvas where focus is directed through vibrant indigo and purple glows, while progress and achievements are marked with "Celestial Gold" accents. The interface remains quiet and unobtrusive until action is required, utilizing geometric patterns and a minimalist mascot to provide personality without distraction.

## Colors
The palette is built on a foundation of deep, layered blues and navies to minimize eye strain and maximize the impact of active elements. 

- **Primary Brand:** Indigo is the core driver of interaction, used for primary actions and active states.
- **Secondary Brand:** Purple provides depth and is used for secondary progress indicators or habit categories.
- **Accents:** Gold and Amber are reserved exclusively for "streaks," achievements, and premium highlights to provide a "reward" sensation against the dark backdrop.
- **Interaction:** Active elements should utilize a subtle 10-15px outer glow using the brand colors to simulate light emitting in a void.

## Typography
This design system leverages **Inter** for its utilitarian clarity and geometric neutrality. 

Headlines use a "Mega-Bold" approach (900 weight) with tight tracking to create a heavy, authoritative presence. Body text remains legible and firm with 500-600 weights, ensuring that even at smaller sizes, the text stands out against the dark surface. Labels use high letter-spacing and uppercase styling to clearly distinguish metadata from content.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile constraints. It uses a 4px baseline grid to maintain a strict rhythm.

- **Margins:** Standard 20px horizontal page margins to provide breathing room.
- **Padding:** Internal card padding is set to 16px to 20px to accommodate the large corner radii.
- **Stacking:** Vertical spacing uses a 1:2:3 ratio (8px, 16px, 24px) to group related habit data and separate global sections.

## Elevation & Depth
Depth is expressed through **Tonal Layers** and **Subtle Glows**. Because the primary background is nearly black, elevation is achieved by lightening the surface color.

1. **Floor:** `#0B0B14` (Deepest depth).
2. **Surface:** `#161626` (Cards, navigation bars).
3. **Elevated:** `#1F1F33` (Modals, popovers, active card states).

Avoid traditional black shadows. Instead, use "Indigo Shadows"—low-opacity glows (`#6366F1` at 10-15% opacity) for high-priority active elements. Apply a 1px border (`#2A2A42`) to all cards to maintain crisp definition against the background.

## Shapes
The shape language is bold and approachable, moving from "Soft" to "Large" roundedness. 

- **Small (8px):** Used for input fields, small chips, and selection indicators.
- **Medium (12px):** Used for standard habit cards and secondary containers.
- **Large (18px):** Reserved for primary CTA buttons and main dashboard cards to create a friendly, tactile feel that invites interaction.

## Components

### Buttons
- **Primary:** Indigo background, white text, 18px radius. Include a subtle glow on the active state.
- **Secondary:** Surface elevated background with a 1px border (`#2A2A42`).
- **Ghost:** No background, Text Secondary, becomes Text Primary on tap.

### Habit Cards
- Use `Background Surface` with a 1px border. 
- Left-hand side: Large geometric icon/mascot placeholder.
- Right-hand side: Progress ring using `Brand Primary` or `Success` colors.
- Interactive state: Card border transitions to `Brand Primary`.

### Input Fields
- Filled style using `Background Elevated`.
- Bottom-aligned labels using the `Label-caps` typography style.
- Focus state: Border changes to Indigo with a 2px glow.

### Progress Indicators
- **Streaks:** Use Gold (`#FDE047`) with a fire icon or geometric spark.
- **Daily Rings:** Thin 4px strokes using Indigo for completed segments and Border color for remaining segments.

### Mascot Integration
- Use geometric, vector-based illustrations of a stylized "Monk" or "Celestial Body."
- Assets should be monochromatic or use the brand secondary purple to stay in the background.
