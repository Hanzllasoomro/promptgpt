# Frontend design

Direction: taste-skill “Framed sheet”, builder, light (seed 1140328583),
from Leonxlnx/taste-skill — the design repo shared in the main chat.
Applied as an app screen, not a landing page.

## Idea

The engineered prompt is the work: it sits on a white sheet, like a
document on a desk. The chrome around it stays quiet so the prompt,
not the decoration, carries the page.

## Tokens (frontend/src/styles.css)

Ground `#f9fbfc`, surface white, raised `#f4f6f8`, border `#e8eaec`,
ink `#131416`, muted `#5d5f60`, accent `#1b6c80` (teal, never violet).
Card radius 8px, control radius 6px, sheet radius 16px, inset 8px
(right and bottom), gap and padding 24px, sidebar 228px.

## Type

IBM Plex Sans (400/500/600) for everything, loaded in index.html with
a system-ui fallback so an offline build still looks right. Titles
22px, sections 16px, body 14px, small 12px. IBM Plex Mono is used only
for API keys — never for prose or labels.

## Layout

Desktop: a tinted L-frame — sidebar (wordmark, navigation, API and
key status) beside a white sheet. The active tab is a 2px accent
underline, everything else in the chrome is grey. On phones the frame
disappears: the sheet becomes the screen and navigation runs across
the top.

Generate uses a two-column work grid: the idea form on the left, the
engineered prompt on the right. Keys uses the settings pattern: a
label column beside a filled panel per provider.

## Rules followed, deliberately

Flat colour only — no gradients, glows, glass or shadows on things at
rest. No emoji, no pill badges, no icon-topped cards, no tiny
tracked-capital labels. Buttons are flat: near-black primary,
raised secondary, text danger. Focus is always visible (accent outline).

## Changing the look

Change tokens in `styles.css` only; every component references them.
Do not add a second accent colour or a new radius without a reason
recorded here.
