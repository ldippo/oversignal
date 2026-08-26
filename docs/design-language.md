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
| Ship (all defs) | 4 | 3 | 4 | 4 | 4 | 4 | PASS — trails, dash streak/stretch, accent palette |
| Beat gate | 5 | 3 | 4 | 4 | 4 | 5 | PASS — shockwave + burst + kick + float text |
| Ring thread | 5 | 3 | 4 | 3 | 3 | 4 | PASS — sparks, chain strobe, float text |
| Shard | 4 | 3 | 4 | 3 | 3 | 4 | PASS — idle spin, shatter burst + hitstop |
| Barrier | 5 | 3 | 4 | 3 | 3 | 4 | PASS — beat pulse, hit vignette + hitstop |
| Pulse fence | 4 | 4 | 4 | 4 | 5 | 4 | PASS — pass burst / damage vignette |
| Finish arch | 4 | 3 | 4 | 3 | 4 | 4 | PASS — shockwave + flash + warp entry |
| Warp tunnel | 4 | 4 | 4 | 4 | 3 | 3 | PASS |
| Sky/celestial | 3 | 4 | 4 | 3 | 4 | n/a | PASS |
| HUD (incl. pips) | 4 | 3 | 4 | 3 | 3 | 3 | PASS |
| Dash fx | 5 | 4 | 4 | 5 | 3 | 5 | PASS — streak stretch, burst, kick, blazing trails |
| Data spire | 4 | 4 | 4 | 3 | 3 | n/a | PASS — seam glow, idle rotation |
| Transmission array | 4 | 4 | 4 | 3 | 4 | n/a | PASS — beat-blinking tip |
| Ghost wireframe | 4 | 5 | 4 | 3 | 3 | n/a | PASS — flicker, pure signal |
| Signal shard cluster | 3 | 4 | 4 | 3 | 3 | n/a | PASS — edge-lit, drift spin |
| Hero landmarks ×4 | 4 | 4 | 4 | 3 | 4 | n/a | PASS — energy-driven glow bands |

Retired: box pylon, monolith, rock (replaced by kit).
Known 3s to push in a future pass: signal fidelity on gameplay solids (scanline
shader), ring reactivity, cluster silhouette.

Feedback is n/a for pure deco (no interaction); deco gates on the other five axes.
