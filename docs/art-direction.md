# OVERSIGNAL — Art Direction Plan v1

Decisions locked 2026-08-26 (grill session). Neon aesthetic, Beat Saber-adjacent
readability: every track object has one job and one read at 400 km/h.

## Core grammar: SHAPE = VERB

- **Ring / hoop** → fly THROUGH (gates, collectibles)
- **Solid angular crystal** → AVOID
- **Flat wide bar** → commit to a lane / duck
- Color does NOT encode verbs. Color encodes rhythm state (on-beat pulse) and
  sector theme (`fx/palette.ts`). Emissive intensity everywhere; bloom does the rest.

## A. Obstacle kit (replaces the box) — `track/features.ts`

| Object | Silhouette | Verb | Notes |
|---|---|---|---|
| SHARD | Tall thin crystal, neon-edged, tilted ~8° toward player | dodge L/R | 1.5× ship width; edge glow in theme obstacle color, dark core |
| BARRIER | Low wide wall covering ~60% of track width, hazard-striped emissive top edge | lane commit | Always leaves ≥ 1 ship-width gap; gap side seeded |
| PULSE FENCE | Full-width energy membrane, visibly "breathing" with beat grid | pass on the beat | Opens (dissolves) in a window around each predicted beat; closed = damage like obstacle |

**Pulse fence fairness (confidence-gated spawn):** generator plans generic
"blocker" slots; at spawn time the slot materializes as PULSE FENCE only when
`music.beatConfidence > 0.6`, otherwise as BARRIER. Open-window width scales with
confidence (min 25%, max 40% of beat cycle). Silent mode always qualifies.

## B. Collectibles: ring threads on the racing line

Scrap octahedra → small glowing rings (torus, ~1.2 m) laid in arcs tracing the
ideal line through corners — collectible path doubles as steering guidance.
- Spacing = beat-distance at cruise speed (`speed * 60/bpm` at gen-time estimate).
- Chain rules: 5+ consecutive rings = bonus scrap + score flourish; missing one
  breaks the chain (no penalty otherwise).
- Magnet upgrade still widens pickup radius.

## C. Sector end: finish gate + warp tunnel (kills the black cutoff)

1. Finish archway (oversized, theme-colored, beat-pulsing) visible from ~500 m;
   ground strip lights lead into it.
2. Crossing: speed-line burst + chromatic flash, HUD "SECTOR CLEAR".
3. Warp state: ship flies inside a camera-anchored cylinder with scrolling
   emissive texture (cheap endless tunnel); upgrade draft renders over it.
4. Card pick → tunnel dissolves, next sector fades in around the ship. No hard
   cut anywhere; warp hides segment rebuild.

## D–F. Environment: full diorama (per-sector theme variants ×4)

- **D. Sky**: gradient dome (theme fog→zenith), one large celestial body
  (low-poly planet/sun silhouette) per theme.
- **E. Trackside**: sparse neon pylons/arches whipping past at track edge
  (speed-sensation multiplier), distant city/monolith silhouettes, slow-drifting
  floating rocks in mid-distance.
- **F. Music-reactive skybox**: dome hue/brightness subtly follows `music.energy`;
  celestial body pulses faintly on `beatPulse`; OVERDRIVE shifts the whole sky.

## Build order (readability first; each step playable + committable)

A obstacle kit → B ring threads → C finish gate + warp → D sky → E trackside → F reactive sky.

## Deferred (explicitly out of this pass)

- ~~Two-tier collectibles~~ — DONE: CORE pickups (+25 scrap, +10 hull) spawn beside hazards
- ~~Obstacle death/hit particle explosions~~ — DONE: juice layer (fx/juice.ts)
- Sweeping blade hazards synced to bars (still deferred: beat-jitter fairness risk)
- Seamless sector stitch / drive-through upgrade lanes (still deferred: v2-scale)
