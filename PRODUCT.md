# Product

## Register

product

(Per-surface override: the title screen and any marketing surface run in **brand** register — they are the game's face. In-run HUD, hangar, drafts, and settings stay product.)

## Users

Players who like fast arcade racers and music games: they arrive with Spotify or YouTube already playing in another tab, want to be racing within seconds, and judge the game in the first ten seconds of the title screen. Sessions are short runs; mobile players get one-thumb play.

## Product Purpose

OVERSIGNAL is a free web anti-gravity roguelite racer that runs on whatever music you're listening to. Live audio analysis turns beats into boost gates, drops into overdrive, energy into world speed. Success: the player syncs their music, immediately understands "drive, hit gates on the beat," and comes back to chase builds (ships + modules) with banked scrap.

## Brand Personality

Electric, precise, alive. Arcade-cabinet attract-mode energy — the world is already running and pulsing behind every menu; UI is projected light ("everything is signal", docs/design-language.md). Confident and terse: the game shows, it never explains.

## Anti-references

- Explainer-text walls: no paragraph copy telling you what the game is. The moving world says it.
- The generic centered-stack-of-buttons menu / settings-page energy on identity surfaces.
- Web-app look: no cards, forms, or input fields on first paint. Game UI, not SaaS.
- Synthwave pastiche (chrome text, sun grids, scanline filters as decoration).

## Design Principles

1. **The game is the background.** Menus render over the live, music-reactive world — never over a void or a static image.
2. **One obvious way in.** Every screen has a single dominant action; everything else is quiet.
3. **Show, don't explain.** Mechanics teach themselves in motion; copy is labels, not lessons.
4. **Solidity encodes danger.** All UI obeys the signal thesis and hard-gate rubric in docs/design-language.md.
5. **Ten-second first impression.** Title → racing in two taps (source, go).

## Accessibility & Inclusion

No formal WCAG target; practical bar: text contrast ≥4.5:1 on HUD/menus, never color-only meaning (shape=verb grammar carries gameplay), reduced-motion users get crossfades instead of pulses on UI (world motion is the game itself), touch targets ≥44px on mobile.
