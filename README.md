# FZERO

Anti-gravity arcade roguelite racer that runs on your music. F-Zero speed, run-based
upgrade drafts, and a beat-synced boost system driven by live audio analysis of
whatever you're listening to — Spotify, YouTube, anything.

**Play:** https://fzero-delta.vercel.app

## How the music mechanic works

Spotify removed its audio-analysis API for new apps (Nov 2024), so this game listens
instead of asking: pick **SYNC TAB AUDIO** and share the tab playing music (tick
"Also share tab audio"). The Web Audio API runs an FFT each frame; a spectral-flux
onset detector estimates BPM and beat phase, and gameplay reads the *predicted* beat
grid so the on-beat window feels right despite detection latency.

- **Beat gates** — pass through a gate on the beat: big boost + PERFECT combo chain.
  Off-beat: small boost, combo resets.
- **Energy** — loudness vs. rolling baseline scales world speed (quiet verse =
  breather, chorus = chaos) and bloom intensity.
- **Bass** — camera rumble.
- **The drop** — a sustained lull followed by an energy spike triggers OVERDRIVE:
  six seconds of invulnerable max-speed.
- **No music?** RUN SILENT uses an internal 120 BPM clock; every mechanic still works.

## Roguelite loop

Run = a chain of procedurally generated sectors (seeded, ~3 km each) that get
narrower, twistier, and more obstacle-dense. Clear a sector → draft 1 of 3 upgrades
(thrusters, hull, shields, magnet, groove window, glass cannon…). Hull hits zero →
run ends, scrap banks to localStorage.

## Controls

W/↑ accelerate · A/D or ←/→ steer · S/↓ brake · Space/Shift boost · 1-3 pick
upgrade · R retry · F3 audio debug overlay. Gamepad supported.

## Dev

```bash
npm install
npm run dev    # localhost:5173
npm run build  # tsc + vite build → dist/
```

Vanilla TypeScript + Three.js, no framework. Ship physics is spline-space
(distance-along + lateral offset) — see `src/ship/ship.ts` and `src/track/spline.ts`.
Audio pipeline: `src/audio/capture.ts` → `analyser.ts` → `beat.ts` → `music-state.ts`.
