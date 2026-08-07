# Card Nest — Master Design System

This file is the implementation design gate for Card Nest mobile and web UI. Product requirements in `HANDOFF.md` remain authoritative.

## Product character

Card Nest is a calm, capable business-card workspace: professional enough for a sales team, approachable enough for a solo founder, and fast enough to use while standing at an event. Interfaces should feel precise, light, and quietly premium—never like a generic admin template.

## Brand

- Official display name: **Card Nest**
- Primary: `#0CC0DF`
- Primary pressed / high-contrast accent: `#079CB8`
- Primary dark: `#067A90`
- Headings: Poppins 600/700
- Body and controls: Open Sans 400/600
- Use the supplied Card Nest logo assets. Do not redraw or distort the mark.

## Color tokens

| Role | Light | Dark |
|---|---|---|
| canvas | `#F7FBFC` | `#071417` |
| surface | `#FFFFFF` | `#0B1F24` |
| elevated surface | `#FFFFFF` | `#102A30` |
| text | `#071417` | `#F7FBFC` |
| text muted | `#60767C` | `#A9BAC0` |
| border | `#CBD7DB` | `#334A50` |
| primary | `#0CC0DF` | `#0CC0DF` |
| primary pressed | `#079CB8` | `#7BE1F0` |
| success | `#168A62` | `#55D6A6` |
| warning | `#B86B00` | `#FFC76B` |
| danger | `#C73A4A` | `#FF8290` |

Never place white body text directly on `#0CC0DF`; use dark ink for sufficient contrast or the darker brand variant for white labels.

## Layout and shape

- Four-point spacing system; primary rhythm is 8 px.
- Screen gutters: 20 px phone, 24–32 px tablet/web.
- Minimum touch target: 48 × 48 dp.
- Radius: 8 small, 12 controls, 18 cards, 24 feature panels, pill only for compact chips.
- Prefer borders, surface contrast, and restrained ambient shadows. Avoid heavy drop shadows and glass effects.
- Keep primary actions reachable in the lower half of phone screens.

## Typography

| Role | Font | Size / line height |
|---|---|---|
| Display | Poppins 700 | 36 / 44 |
| Screen title | Poppins 600 | 24 / 32 |
| Section title | Poppins 600 | 18 / 26 |
| Body large | Open Sans 400 | 18 / 28 |
| Body | Open Sans 400 | 16 / 25 |
| Label | Open Sans 600 | 14 / 20 |
| Caption | Open Sans 400 | 12 / 17 |

Use sentence case. Reserve all-caps for very short eyebrow labels with added letter spacing.

## Navigation

- Authenticated mobile navigation has five destinations: Home, Search, Scan, Cards, Settings.
- Scan is the visually prominent center action, but remains accessible by label—not icon alone.
- Each tab has an icon and visible text label.
- Navigation state must survive session refresh and deep-link handoff.

## Core components

- Buttons: primary filled brand-dark with white text, secondary bordered, tertiary text-only, destructive red. Always show disabled and busy states.
- Inputs: persistent visible label, 48 px minimum height, explicit helper/error text, never placeholder-only labeling.
- Cards: 18 px radius, light border, strong information hierarchy; make the whole row tappable when it opens one destination.
- Status chips: icon + text + color; never communicate state by color alone.
- Lists: virtualized, predictable row height where practical, skeleton initial state, inline pagination state.
- Empty states: explain the benefit and give one clear next action.
- Errors: plain-language cause when known, recovery action, and preserved user input.

## Motion

- Launch sequence: 1.2–2 seconds maximum, logo/card forms with subtle spring movement; transition into the app without a white flash.
- Interaction motion: 140–220 ms. Use opacity and transform, not layout-heavy animation.
- Respect the operating-system reduced-motion preference; replace springs and parallax with short fades.
- Never delay an available action only to finish decorative motion.

## Accessibility and quality gates

- WCAG AA contrast for normal text; 3:1 for large text and meaningful UI graphics.
- Support font scaling and screen readers; provide concise accessibility labels and hints for icon buttons.
- Keyboard-safe forms and visible web focus states.
- Confirm destructive card/account deletion; do not confirm routine reversible actions.
- Every async feature must define loading, success, empty, recoverable error, offline, and retry states.
- Test narrow phone, large phone, tablet/web width, light/dark mode, reduced motion, slow network, and offline behavior.

## Anti-patterns

- No default Expo/Supabase template presentation.
- No decorative emoji icons.
- No technical implementation copy in user-facing screens.
- No hidden destructive gestures as the only path.
- No long centered paragraphs, gratuitous gradients, excessive pills, or over-rounded nested containers.
- Never expose Supabase hostnames in user-visible URLs, errors, or help copy.
