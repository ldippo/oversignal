# OVERSIGNAL

Anti-gravity arcade roguelite racer that runs on your music. F-Zero speed,
run-based upgrade drafts, a ship-and-module hangar, and a beat-synced dash
economy driven by live audio analysis of whatever you're listening to —
Spotify, YouTube, anything.

**Play:** https://oversignal.vercel.app

## Play your music (the flagship mode)

**PLAY YOUR MUSIC** on the title opens the music picker: drop in your own audio
files (mp3/wav/m4a/ogg — multi-select queues a playlist) or browse/search
**Audius** trending and race any track. Either way the full track is decoded
and analyzed *before* launch — exact beat grid, real drop detection, energy
mapped to the actual arrangement. No prediction, no capture, works identically
on every platform (this is the mode that carries to future native builds).

## How the live-sync mechanic works

Spotify removed its audio-analysis API for new apps (Nov 2024), so this game
listens instead of asking: pick **SYNC YOUR MUSIC** and share the tab playing
audio (tick "Also share tab audio"). The Web Audio API runs an FFT each frame;
a spectral-flux onset detector estimates BPM and beat phase, and gameplay reads
the *predicted* beat grid so on-beat timing feels right despite detection latency.

- **Beat gates** — cross on the beat: boost + PERFECT combo + a dash pip.
- **Pulse fences** — energy membranes that open on the beat; cross in rhythm,
  thread the narrow edge lane, or take the hit. Only spawn when the beat
  tracker is confident.
- **Energy** — loudness vs. rolling baseline scales world speed, sky
  brightness, and how loud the effects hit (quiet verse = breather).
- **The drop** — a sustained lull followed by an energy spike triggers
  OVERDRIVE: six seconds of invulnerable max-speed.
- **No music?** Play-without-music mode uses an internal 120 BPM clock; every
  mechanic still works.

## Pulse dash

Space (or the DASH button on mobile) spends a pip: half a second of surge with
i-frames. Dash *through* shards and barriers to shatter them for score instead
of taking damage. Pips come from musical play — on-beat gates and 5-ring
chains — so aggression is funded by rhythm.

## Roguelite loop

Run = a chain of procedurally generated sectors (seeded, ~3 km) that get
narrower, twistier, and denser. Rings trace the racing line (chains pay bonus
scrap); CORE pickups sit right beside hazards for risk/reward grabs. Clear a
sector → warp tunnel → draft 1 of 3 upgrades (module-synergy cards appear when
you've socketed the matching module). Hull hits zero → scrap banks.

**Hangar** (from the title): five ships with stat trade-offs (STINGER free;
JUGGERNAUT, RAZOR, METRONOME, PHANTOM priced in scrap) and nine one-time
modules in DASH / TEMPO / SALVAGE families, socketed into 2–3 slots per ship.

## Controls

W/↑ accelerate · A/D or ←/→ steer · S/↓ brake · **Space = pulse dash** ·
1-3 pick upgrade · R retry · F3 audio debug overlay. Gamepad supported.
Mobile: auto-accelerate, hold left/right half to steer, DASH/BRAKE buttons.

## Spotify now-playing card (optional)

Cosmetic track + album art card. Authorization Code + PKCE, no backend.
Setup: create an app at https://developer.spotify.com/dashboard, add your
origin as redirect URI (e.g. `https://oversignal.vercel.app/`), then paste
the Client ID via the title's SPOTIFY button (stored in localStorage) or set
`VITE_SPOTIFY_CLIENT_ID` at build time. Scope: `user-read-currently-playing`.

## Dev

```bash
npm install
npm run dev    # localhost:5173
npm run build  # tsc + vite build → dist/
```

Vanilla TypeScript + Three.js, no framework. Ship physics is spline-space
(distance-along + lateral offset) — `src/ship/ship.ts`, `src/track/spline.ts`.
Audio pipeline: `src/audio/capture.ts` → `analyser.ts` → `beat.ts` →
`music-state.ts`. Design language and the hard-gate art rubric live in
`docs/design-language.md`; product principles in `PRODUCT.md`.
