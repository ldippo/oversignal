# FZERO Design Language — EVERYTHING IS SIGNAL

The world of FZERO is not made of matter. Everything the player sees is projected
light, transmitted energy, running signal. Nothing has mass; everything has
brightness, frequency, and decay.

**The one rule: the more solid something looks, the more it hurts.**

## Material rules

| Class | Treatment | Examples |
|---|---|---|
| Interactive (fly through) | Holographic: emissive edges, translucent faces, scanline shimmer, beat-reactive | gates, rings, finish arch |
| Hazard (avoid/time) | Corrupted signal: dark solid cores, oversaturated edges, jitter/glitch, harsher motion | shards, barriers, pulse fences |
| Deco (world) | Ghost transmissions: faint wireframes, low-opacity volumes, slow idle motion, distant flicker | spires, arrays, ghost structures, shard clusters, heroes |
| Player | Pure signal: brightest thing on screen, always trailed, state visible at a glance | ship, dash streak, trails |
| UI | Flat signal readouts: no chrome, glow only where live (combo, pips, banners) | HUD, screens |

Palette discipline: each sector theme owns the hues (fx/palette.ts). Role decides
intensity, not hue — interactive bright, hazard oversaturated, deco faint. The only
hue reserved across all themes is white (player-perfect moments) and red-glitch
(damage).

## Rubric — hard gate

Six axes, 1–5. **Ship gate: Silhouette ≥4 AND Feedback ≥4 AND every other axis ≥3.**
Anything below gate is reworked before commit. Score every new or changed visual
element in the table below.

| Axis | 1 | 3 | 5 |
|---|---|---|---|
| Silhouette | unreadable at speed / verb unclear | verb readable when expected | verb readable in peripheral vision at max speed |
| Signal fidelity | reads as solid matter / breaks thesis | mostly thesis-compliant | unmistakably projected light; solidity encodes danger |
| Palette discipline | off-theme hues / role unclear from intensity | theme hues, minor noise | theme hues only; role identifiable from intensity alone |
| Motion identity | static prop | some idle life | never still; idle motion characterizes the object |
| Reactivity | ignores music | responds to beat or energy | distinct responses to beat, energy, and overdrive |
| Feedback | interaction changes nothing on screen | single-layer response | world + camera + UI layers, scaled to event importance |

## Scoring table

Scores as of each pass; NEW = not yet built. Rework anything failing gate.

| Element | Silh | Signal | Palette | Motion | React | Feedback | Gate |
|---|---|---|---|---|---|---|---|
| Ship (all defs) | 4 | 2 | 4 | 3 | 2 | 2 | FAIL — needs trails, dash state, signal materials |
| Beat gate | 5 | 3 | 4 | 4 | 4 | 3 | FAIL — pass-through needs world+UI layers |
| Ring thread | 5 | 3 | 4 | 3 | 2 | 2 | FAIL — collect needs sparks + floating score |
| Shard | 4 | 3 | 4 | 1 | 1 | 2 | FAIL — needs idle jitter, glitch, shatter fx |
| Barrier | 5 | 3 | 4 | 1 | 1 | 2 | FAIL — needs hazard motion + hit response |
| Pulse fence | 4 | 4 | 4 | 4 | 5 | 2 | FAIL — pass/hit needs layered response |
| Finish arch | 4 | 3 | 4 | 3 | 4 | 3 | FAIL — crossing moment needs more than flash |
| Warp tunnel | 4 | 4 | 4 | 4 | 3 | 3 | PASS (marginal) |
| Pylon | 3 | 2 | 4 | 1 | 1 | n/a | FAIL — replace with kit |
| Monolith | 2 | 1 | 3 | 1 | 1 | n/a | FAIL — replace with kit |
| Rock | 2 | 1 | 2 | 3 | 1 | n/a | FAIL — replace with shard cluster |
| Sky/celestial | 3 | 4 | 4 | 3 | 4 | n/a | PASS |
| HUD | 4 | 3 | 4 | 3 | 3 | 3 | PASS (marginal) |
| Dash fx | NEW | | | | | | |
| Juice (per event) | NEW | | | | | | |
| Data spire | NEW | | | | | | |
| Transmission array | NEW | | | | | | |
| Ghost wireframe | NEW | | | | | | |
| Signal shard cluster | NEW | | | | | | |
| Hero landmarks ×4 | NEW | | | | | | |

Feedback is n/a for pure deco (no interaction); deco gates on the other five axes.
