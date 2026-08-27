# OVERSIGNAL Design Language — EVERYTHING IS SIGNAL

The world of OVERSIGNAL is not made of matter. Everything the player sees is projected
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
| Ship (5 distinct models) | 5 | 4 | 4 | 4 | 4 | 4 | PASS — per-ship silhouettes tied to rules: dart / rail-bruiser / needle / tuning-fork / ghost-delta; edge glow, nozzle rings, underglow |
| Beat gate | 5 | 3 | 4 | 4 | 4 | 5 | PASS — shockwave + burst + kick + float text |
| Ring thread | 5 | 3 | 4 | 3 | 4 | 4 | PASS — beat-pulse scale, sparks, chain strobe |
| Core pickup | 4 | 4 | 4 | 4 | 4 | 4 | PASS — halo ring, spin, beat pulse, burst + heal text |
| Shard | 4 | 3 | 4 | 3 | 3 | 4 | PASS — idle spin, shatter burst + hitstop |
| Barrier | 5 | 3 | 4 | 3 | 3 | 4 | PASS — beat pulse, hit vignette + hitstop |
| Pulse fence | 4 | 5 | 4 | 4 | 5 | 4 | PASS — scanline shimmer membrane |
| Finish arch | 4 | 3 | 4 | 3 | 4 | 4 | PASS — shockwave + flash + warp entry |
| Warp tunnel | 4 | 4 | 4 | 4 | 3 | 3 | PASS |
| Sky/celestial | 3 | 4 | 4 | 3 | 4 | n/a | PASS |
| HUD (incl. pips) | 4 | 3 | 4 | 3 | 3 | 3 | PASS |
| Dash fx | 5 | 4 | 4 | 5 | 3 | 5 | PASS — streak stretch, burst, kick, blazing trails |
| Data spire | 4 | 4 | 4 | 3 | 3 | n/a | PASS — seam glow, idle rotation |
| Transmission array | 4 | 4 | 4 | 3 | 4 | n/a | PASS — beat-blinking tip |
| Ghost wireframe | 4 | 5 | 4 | 3 | 3 | n/a | PASS — flicker, pure signal |
| Signal shard cluster | 4 | 4 | 4 | 3 | 3 | n/a | PASS — dominant spire + shared-axis satellites |
| Hero landmarks ×4 | 4 | 4 | 4 | 3 | 4 | n/a | PASS — energy-driven glow bands |
| Tunnel arches | 4 | 4 | 4 | 3 | 4 | n/a | PASS — beat-pulsing ring corridor |
| Mega-gate | 5 | 3 | 4 | 4 | 4 | 5 | PASS — double-beam silhouette, doubled fx |

| Ocean biome (whale/jelly/school) | 4 | 5 | 4 | 4 | 4 | n/a | PASS — wireframe leviathans, beat-pulsing jellyfish |
| Forest biome (pines/deer/flocks) | 4 | 4 | 4 | 3 | 3 | n/a | PASS — instanced pines w/ glow tips, flapping chevron flocks |
| Canyon biome (mesas/UFOs) | 4 | 4 | 4 | 3 | 4 | n/a | PASS — strata seams, bobbing saucers w/ flickering beams |

Retired: box pylon, monolith, rock (replaced by kit).
Juice is adaptive: all burst/kick/rumble intensity scales with music energy
(0.55 in quiet passages → ~1.25 at full chorus); shockwaves and hitstop stay
constant as marquee punctuation.

Feedback is n/a for pure deco (no interaction); deco gates on the other five axes.
