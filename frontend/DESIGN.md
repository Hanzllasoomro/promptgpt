# Frontend design — v4

Replaces v3 entirely. The v3 files are gone; this document is the
current system.

## Reference: Claude, ChatGPT and Muse, adapted — not copied

No brand assets, logos or proprietary faces are copied. What is
borrowed is the shared language of those products, recombined:

- **ChatGPT's shell** — a dark sidebar for navigation, a light
  working area, one black primary action, a rounded, softly shadowed
  chat composer.
- **Claude's warmth** — a warm paper canvas instead of stark white,
  a single terracotta accent used only for "active" and "focus",
  generous whitespace.
- **Muse-style polish** — a geometric display face for titles, mono
  for anything technical, quiet hairline borders and one restrained
  shadow per card, nothing glossy.

## Fonts — built on the user's own index.html edit

After v3, the user edited `frontend/index.html` on GitHub: a meta
description, a dark theme colour, a favicon, and a new font line
(Inter variable, Outfit, JetBrains Mono). v4 keeps all of that
exactly and designs around it, instead of reverting to v3's fonts:

- **Outfit** (300–700) — display titles and the wordmark only.
  Geometric, high-tech, and already loaded by the user.
- **Inter** (variable, 100–900, used at 400–700) — body and UI.
- **JetBrains Mono** (400, 500) — API keys, model names, latency and
  other figures only. Prompt prose stays in Inter.

Semantic scale, in `rem` so the reader's browser font size still
applies, with unitless line-heights:

| Role | Size | Line-height | Weight | Tracking |
| --- | --- | --- | --- | --- |
| Display (page title) | 2.75rem | 1.05 | 600 | -0.02em |
| Title | 1.75rem | 1.2 | 600 | -0.01em |
| Section | 1.25rem | 1.3 | 600 | -0.01em |
| Body | 1rem | 1.6 | 400 | 0 |
| UI | 0.875rem | 1.5 | 500 | 0 |
| Small | 0.8125rem | 1.5 | 400 | 0 |
| Caption | 0.75rem | 1.5 | 400 | 0 |

Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.
Long text is capped at 75 characters per line. Figures that change
(latency, key counts) use `font-variant-numeric: tabular-nums`.
Inputs stay at 1rem on phones so iOS does not zoom the page.
Font smoothing is set once on the root, never per component.

## Colour — semantic tokens only

No literal colour, shadow or font-family appears past the `:root`
block in `styles.css`. Components reference semantic tokens only:

Canvas warm paper `#faf9f5`, cards white, document and settings
fields `#f5f4ef`, inputs `#fbfaf7`; border `#e7e5df`, strong
border `#d9d6ce`; text `#141413`, secondary `#6b6a67`,
tertiary `#8a8985` (small text only); primary `#171717` with white
ink; accent terracotta `#d97757` — one meaning only: active
navigation and keyboard focus; success `#067647`; danger `#b42318`.
Sidebar: `#171717` ground, `#faf9f5` text, `#a8a8a3` secondary,
`#262625` hover/active, `#2e2e2e` border.

## Layout

App shell capped at 1440px and centred: a 272px dark sidebar
(wordmark with a terracotta full stop, navigation, API and key
status) beside the main column, capped at 1152px. Groups are
separated by 32–48px, items inside a group by 8–16px. Generate is
a two-column work grid (brief left, engineered prompt right).
Keys is a settings grid (label column beside a field panel).
The composer is a 24px rounded, softly shadowed card. On phones
the sidebar becomes a dark top bar and every grid stacks; nothing
is positioned with `order` or reversed grid placement, so visual
order matches DOM order.

## Motion and the Hallmark floor

Named properties only (`background-color`, `border-color`, `opacity`,
`transform`), 150ms for interaction, 300ms for infrequent entrances.
A pressed button scales to 0.96. Entrances stagger 100ms. Under
`prefers-reduced-motion` all of it drops to no animation. Hover
styles sit behind `@media (hover: hover)`. Every colour and font
goes through a token, never `transition: all`, never animating
width/height, instant `:focus-visible` (in the accent colour),
no invented metrics, no eyebrow or tracked-capital labels, no
card inside a card, no decorative status dots, no arrows glued
to link text, container capped and centred.

## Persistence — what survives a restart

This look change touches no state. PromptGPT's user state lives
in browser localStorage, not server memory: API keys
(`promptgpt:keys`) and generated history (`promptgpt:history`).
Pulling v4, restarting the dev server, or restarting the machine
does not wipe either — they live in the browser profile, and the
backend is stateless. The only way to lose them is clearing
browser storage or using the Keys / History clear buttons.
Version marker for the stale-server check: `frontend/package.json`
is `2.1.0` in v4. If the sidebar is still light grey, an old
server is still serving the build — stop it first, then pull.

## Changing the look

Change tokens in `styles.css` only. Do not add a second accent, a
fourth typeface, or a new radius without recording the reason here.
