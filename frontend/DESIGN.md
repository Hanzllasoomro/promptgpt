# Frontend design — v3

Replaces the v2 “Framed sheet” look entirely. The v2 files are gone;
this document is the current system.

## Reference: OpenAI, not a template

The model is OpenAI / ChatGPT's product surface: white ground, near-black
text, quiet grey surfaces, one black primary action, generous whitespace,
and type doing the work instead of decoration. No brand assets were
copied — only that restraint, rebuilt here in our own tokens.

## Skills used, and one deliberately not used

- **jakubkrehel/skills** (`better-typography`, `better-ui`, `better-layout`,
  `better-colors`, `better-accessibility`): the type scale, spacing, motion
  and colour rules below. Inter is the interface face it lists for this
  category; JetBrains Mono is the mono outlier for keys and figures.
- **Leonxlnx/taste-skill**: the anti-slop floor — no gradients, glows,
  glass, emoji or purple-blue gradients; scale and full content instead
  of ornament.
- **Nutlope/hallmark**: the Floor — every colour and font goes through a
  token, never `transition: all`, never animating width/height, instant
  `:focus-visible`, a `prefers-reduced-motion` fallback, no invented
  metrics, no eyebrow or tracked-capital labels, no card inside a card,
  no decorative status dots, no arrows glued to link text, container
  capped and centred. The CSS file opens with the Hallmark stamp.
- **nextlevelbuilder/ui-ux-pro-max-skill**: its “Minimal Swiss” and
  “Minimalism & Swiss Style” entries and its Inter-based pairings
  (including Inter + JetBrains Mono for developer tools) confirm the
  single-family choice; its pre-delivery checklist (contrast, keyboard,
  visible focus, reduced motion) is the check used here.
- **oso95/scroll-world**: read, not run. It is a paid AI-video pipeline
  (Higgsfield stills plus Monid/Seedance video clips, roughly $27 for a
  six-scene chain, plus paid accounts and auth) for scroll-cinematic
  *landing pages*. PromptGPT is a working app, not a landing film, and
  no budget or account was approved for that pipeline. Its only
  contribution here is restraint: motion is entrance-only (opacity and
  a 12px rise, staggered 100ms), never scroll-jacking, never video.

## Typography — the whole point of this version

Families (loaded in `index.html`, every weight the design uses, with a
system fallback so an offline build still renders):

- **Inter** (400, 500, 600, 700) — body and UI.
- **Inter Tight** (600) — display titles only.
- **JetBrains Mono** (400, 500) — API keys, model names, latency and
  other figures only. Prompt prose stays in Inter.

Semantic scale, in `rem` so the reader's browser font size still
applies, with unitless line-heights:

| Role | Size | Line-height | Weight | Tracking |
| --- | --- | --- | --- | --- |
| Display (page title) | 2.5rem | 1.1 | 600 | -0.02em |
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

No literal colour or font-family appears past the `:root` block in
`styles.css`. Components reference semantic tokens only:

Background white, subtle `#f9f9f9`, raised `#f4f4f4`, hover `#ececec`;
border `#e5e5e5`, strong border `#d4d4d4`; text `#0d0d0d`,
secondary `#5d5d5d`, tertiary `#8a8a8a` (small text only); primary
black with white ink; success `#067647`; danger `#b42318`.
One filled action per view gets the black fill; peers stay neutral
with a border.

## Layout

App shell capped at 1440px and centred: a 260px sidebar in subtle
grey (wordmark, navigation, API and key status) beside the main
column, which is itself capped at 1152px. Groups are separated by
32–48px, items inside a group by 8–16px. Generate is a two-column
work grid (brief left, engineered prompt right). Keys is a settings
grid (label column beside a field panel). On phones the sidebar
becomes a top bar and every grid stacks; nothing is positioned with
`order` or reversed grid placement, so visual order matches DOM order.

## Motion

Named properties only (`background-color`, `border-color`, `opacity`,
`transform`), 150ms for interaction, 300ms for infrequent entrances.
A pressed button scales to 0.96. Entrances stagger 100ms (title,
then content). Under `prefers-reduced-motion` all of it drops to no
animation. Hover styles sit behind `@media (hover: hover)` so taps
do not latch a hover state.

## Changing the look

Change tokens in `styles.css` only. Do not add a second accent, a
third typeface, or a new radius without recording the reason here.
