import * as THREE from "three";
import type { SectorTheme } from "./palette";

/**
 * Signal architecture kit — all deco obeys the thesis: the world is projected
 * light. Solids are near-black; identity comes from emissive seams, edges,
 * and wireframe ghosts. Generators are seeded via the caller's rand().
 */

type Rand = () => number;

const DARK = 0x05060e;

function darkMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.85, metalness: 0.3 });
}

/** Stacked rotated slabs with glowing seams. Slow idle rotation via userData.spin. */
export function dataSpire(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const levels = 5 + Math.floor(rand() * 5);
  const base = 6 + rand() * 5;
  let y = -8;
  for (let i = 0; i < levels; i++) {
    const t = i / levels;
    const w = base * (1 - t * 0.55) * (0.85 + rand() * 0.3);
    const h = 4 + rand() * 7;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), darkMat());
    slab.position.y = y + h / 2;
    slab.rotation.y = rand() * Math.PI;
    g.add(slab);
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.04, 0.18, w * 1.04),
      new THREE.MeshBasicMaterial({ color: theme.gate, transparent: true, opacity: 0.75 }),
    );
    seam.position.y = y + h;
    seam.rotation.y = slab.rotation.y;
    g.add(seam);
    y += h + 0.2;
  }
  g.userData.spin = (rand() - 0.5) * 0.06;
  return g;
}

/** Mast + rings + blinking tip. Tip pulses with the beat via userData.tip. */
export function transmissionArray(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const h = 26 + rand() * 22;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, h, 6), darkMat());
  mast.position.y = h / 2 - 8;
  g.add(mast);
  const rings = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < rings; i++) {
    const r = 3.5 + rand() * 4 - i;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(2, r), 0.12, 6, 24),
      new THREE.MeshBasicMaterial({ color: theme.edgeLeft, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h * (0.45 + i * 0.22) - 8;
    g.add(ring);
  }
  const tipMat = new THREE.MeshBasicMaterial({ color: theme.gate });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), tipMat);
  tip.position.y = h - 8;
  g.add(tip);
  g.userData.tip = tipMat;
  return g;
}

/** Huge faint wireframe structure on the horizon. Flickers via userData.ghost. */
export function ghostWireframe(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({
    color: theme.edgeRight,
    transparent: true,
    opacity: 0.12,
  });
  let source: THREE.BufferGeometry;
  if (rand() < 0.5) {
    // broadcast tower: stacked tapering boxes
    const group: THREE.BufferGeometry[] = [];
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const w = 40 * (1 - i * 0.2);
      const h = 35 + rand() * 20;
      const box = new THREE.BoxGeometry(w, h, w);
      box.translate(0, y + h / 2, 0);
      group.push(box);
      y += h;
    }
    source = mergeGeometries(group);
  } else {
    // ring station
    const torus = new THREE.TorusGeometry(55 + rand() * 25, 6, 6, 24);
    source = torus;
  }
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(source, 12), mat);
  source.dispose();
  g.add(wire);
  g.userData.ghost = mat;
  g.userData.ghostPhase = rand() * 10;
  return g;
}

// minimal merge (avoids importing BufferGeometryUtils for 4 boxes)
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const index: number[] = [];
  let vOff = 0;
  let pOff = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array as Float32Array, pOff);
    const idx = g.index!;
    for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + vOff);
    vOff += g.attributes.position.count;
    pOff += g.attributes.position.count * 3;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setIndex(index);
  return merged;
}

/**
 * Edge-lit crystal cluster; replaces rocks. One dominant spire + satellites
 * sharing its tilt axis — reads as a single silhouette, not scattered debris.
 */
export function shardCluster(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const tiltX = (rand() - 0.5) * 0.7;
  const tiltZ = (rand() - 0.5) * 0.7;
  const addCrystal = (scaleY: number, offset: THREE.Vector3, girth: number): void => {
    const geo = new THREE.OctahedronGeometry(1);
    geo.scale(girth, scaleY, girth);
    const core = new THREE.Mesh(geo, darkMat());
    core.position.copy(offset);
    core.rotation.set(tiltX + (rand() - 0.5) * 0.25, rand() * Math.PI, tiltZ + (rand() - 0.5) * 0.25);
    g.add(core);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: theme.scrap, transparent: true, opacity: 0.55 }),
    );
    edges.position.copy(core.position);
    edges.rotation.copy(core.rotation);
    g.add(edges);
  };
  addCrystal(3.2 + rand() * 2, new THREE.Vector3(0, 0, 0), 0.9 + rand() * 0.3);
  const satellites = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < satellites; i++) {
    const angle = rand() * Math.PI * 2;
    const r = 2.2 + rand() * 2.5;
    addCrystal(
      1 + rand() * 1.4,
      new THREE.Vector3(Math.cos(angle) * r, -1 - rand() * 1.5, Math.sin(angle) * r),
      0.5 + rand() * 0.4,
    );
  }
  g.userData.spin = (rand() - 0.5) * 0.3;
  return g;
}

/** One mega-structure per theme, parked on the horizon. Glow via userData.hero. */
export function heroLandmark(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color: theme.celestial, transparent: true, opacity: 0.5 });
  switch (theme.name) {
    case "NEON STRAIT": {
      // ringed station: fat torus + inner hub + spokes
      const ring = new THREE.Mesh(new THREE.TorusGeometry(120, 14, 8, 40), darkMat());
      g.add(ring);
      const band = new THREE.Mesh(new THREE.TorusGeometry(120, 2.2, 6, 60), glow);
      g.add(band);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(30, 8, 6), darkMat());
      g.add(hub);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(4, 240, 4), darkMat());
        spoke.rotation.z = (i / 4) * Math.PI;
        g.add(spoke);
      }
      break;
    }
    case "EMBER FIELD": {
      // broken dyson arc: partial torus segments with gaps
      for (let i = 0; i < 5; i++) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(150, 10, 6, 8, 0.7 + rand() * 0.4), darkMat());
        arc.rotation.z = i * 1.35 + rand() * 0.3;
        g.add(arc);
        const seam = new THREE.Mesh(new THREE.TorusGeometry(150, 1.6, 4, 10, 0.7), glow);
        seam.rotation.z = arc.rotation.z;
        g.add(seam);
      }
      break;
    }
    case "VIOLET DEEP": {
      // inverted mountain city: upside-down stacked cones with light bands
      for (let i = 0; i < 3; i++) {
        const size = 90 - i * 25;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(size, 110 - i * 20, 7), darkMat());
        cone.rotation.x = Math.PI;
        cone.position.set((i - 1) * 85, i * 24, (rand() - 0.5) * 60);
        g.add(cone);
        const band = new THREE.Mesh(new THREE.TorusGeometry(size * 0.7, 1.8, 4, 24), glow);
        band.rotation.x = Math.PI / 2;
        band.position.copy(cone.position).y += 24;
        g.add(band);
      }
      break;
    }
    case "THE ABYSS": {
      const leviathan = whale(rand, theme.celestial);
      leviathan.scale.setScalar(4.5);
      g.add(leviathan);
      break;
    }
    case "VERDANT REACH": {
      // colossal tree: trunk + stacked canopies with glow rings
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(8, 13, 100, 8), darkMat());
      g.add(trunk);
      let y = 25;
      let r = 62;
      for (let i = 0; i < 3; i++) {
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(r, 58, 8), darkMat());
        canopy.position.y = y + 29;
        g.add(canopy);
        const ringSeam = new THREE.Mesh(new THREE.TorusGeometry(r * 0.75, 1.6, 4, 26), glow);
        ringSeam.rotation.x = Math.PI / 2;
        ringSeam.position.y = y + 6;
        g.add(ringSeam);
        y += 40;
        r *= 0.68;
      }
      break;
    }
    case "RED CANYON": {
      const mothership = ufo(rand, theme.celestial);
      mothership.scale.setScalar(15);
      g.add(mothership);
      break;
    }
    default: {
      // ACID RUN — signal refinery: cylinder stacks + glowing pipes
      for (let i = 0; i < 4; i++) {
        const h = 90 + rand() * 70;
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(16 + rand() * 10, 20 + rand() * 10, h, 8), darkMat());
        stack.position.set((i - 1.5) * 55, h / 2 - 40, (rand() - 0.5) * 40);
        g.add(stack);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, h * 0.8, 6), glow);
        pipe.position.copy(stack.position);
        pipe.position.x += 14;
        g.add(pipe);
      }
      break;
    }
  }
  g.userData.hero = glow;
  return g;
}

// ==================== BIOME LIFE (wireframe signal creatures) ====================

function wireMat(color: number, opacity = 0.8): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity });
}

/** Big slow wireframe whale; drifts along userData.swimDir, loops in a range. */
export function whale(rand: Rand, color: number): THREE.Group {
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(1, 10, 7);
  bodyGeo.scale(3.2, 2.6, 11);
  const body = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshBasicMaterial({ color: 0x02080c, transparent: true, opacity: 0.55 }),
  );
  g.add(body);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 8), wireMat(color, 0.65)));
  const flukeGeo = new THREE.BoxGeometry(5.2, 0.25, 2.2);
  const fluke = new THREE.Mesh(flukeGeo, new THREE.MeshBasicMaterial({ color: 0x02080c }));
  fluke.position.set(0, 0.6, 11.6);
  fluke.rotation.x = 0.35;
  g.add(fluke);
  const flukeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(flukeGeo), wireMat(color, 0.8));
  flukeEdges.position.copy(fluke.position);
  flukeEdges.rotation.copy(fluke.rotation);
  g.add(flukeEdges);
  for (const side of [-1, 1]) {
    const finGeo = new THREE.BoxGeometry(3.4, 0.2, 1.4);
    const fin = new THREE.Mesh(finGeo, new THREE.MeshBasicMaterial({ color: 0x02080c }));
    fin.position.set(side * 3.4, -1.1, -2);
    fin.rotation.z = side * 0.4;
    g.add(fin);
  }
  g.userData.creature = "whale";
  g.userData.speed = 2.5 + rand() * 2;
  g.userData.phase = rand() * 10;
  return g;
}

/** Jellyfish: translucent dome + tentacle lines; bobs and pulses with the beat. */
export function jellyfish(rand: Rand, color: number): THREE.Group {
  const g = new THREE.Group();
  const domeGeo = new THREE.SphereGeometry(1.6 + rand(), 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  g.add(dome);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(domeGeo, 10), wireMat(color, 0.7)));
  const tentPts: THREE.Vector3[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r0 = 1.0;
    tentPts.push(new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0));
    tentPts.push(new THREE.Vector3(Math.cos(a) * (r0 + rand() * 0.6), -3 - rand() * 2, Math.sin(a) * (r0 + 0.4)));
  }
  const tentGeo = new THREE.BufferGeometry().setFromPoints(tentPts);
  g.add(new THREE.LineSegments(tentGeo, wireMat(color, 0.45)));
  g.userData.creature = "jelly";
  g.userData.phase = rand() * 10;
  return g;
}

/** School of fish: a Points blob that slowly orbits its anchor. */
export function fishSchool(rand: Rand, color: number): THREE.Points {
  const n = 46;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rand() - 0.5) * 10;
    pos[i * 3 + 1] = (rand() - 0.5) * 4;
    pos[i * 3 + 2] = (rand() - 0.5) * 10;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color, size: 0.5, transparent: true, opacity: 0.85, sizeAttenuation: true }),
  );
  pts.userData.creature = "school";
  pts.userData.phase = rand() * 10;
  return pts;
}

/** Wireframe deer: body, legs, neck, antlers as line segments over a dark core. */
export function deer(rand: Rand, color: number): THREE.Group {
  const g = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(0.9, 1.0, 2.2);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x040804 }));
  body.position.y = 1.5;
  g.add(body);
  const bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), wireMat(color, 0.85));
  bodyEdges.position.copy(body.position);
  g.add(bodyEdges);
  const pts: THREE.Vector3[] = [];
  const leg = (x: number, z: number): void => {
    pts.push(new THREE.Vector3(x, 1.0, z), new THREE.Vector3(x, 0, z));
  };
  leg(-0.35, -0.8); leg(0.35, -0.8); leg(-0.35, 0.8); leg(0.35, 0.8);
  // neck + head
  pts.push(new THREE.Vector3(0, 2.0, -1.1), new THREE.Vector3(0, 2.9, -1.6));
  pts.push(new THREE.Vector3(0, 2.9, -1.6), new THREE.Vector3(0, 2.85, -2.15));
  // antlers
  for (const side of [-1, 1]) {
    pts.push(new THREE.Vector3(0, 2.9, -1.6), new THREE.Vector3(side * 0.5, 3.6, -1.5));
    pts.push(new THREE.Vector3(side * 0.5, 3.6, -1.5), new THREE.Vector3(side * 0.8, 4.1, -1.7));
    pts.push(new THREE.Vector3(side * 0.5, 3.6, -1.5), new THREE.Vector3(side * 0.35, 4.2, -1.3));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), wireMat(color, 0.85)));
  g.rotation.y = rand() * Math.PI * 2;
  return g;
}

/** Flock of chevron birds; flies across the track, wings flap, loops. */
export function birdFlock(rand: Rand, color: number): THREE.Group {
  const g = new THREE.Group();
  const count = 5 + Math.floor(rand() * 4);
  const wingMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < count; i++) {
    const bird = new THREE.Group();
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.32), wingMat);
      wing.position.x = side * 0.5;
      wing.userData.side = side;
      bird.add(wing);
    }
    bird.position.set((rand() - 0.5) * 14, (rand() - 0.5) * 5, (rand() - 0.5) * 10);
    bird.userData.flapPhase = rand() * 10;
    g.add(bird);
  }
  g.userData.creature = "flock";
  g.userData.speed = 8 + rand() * 5;
  g.userData.range = 260;
  g.userData.phase = rand() * 10;
  return g;
}

/** Stratified canyon mesa: stacked slabs with glowing strata seams. */
export function mesa(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const w = 26 + rand() * 34;
  let y = -12;
  const layers = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < layers; i++) {
    const lw = w * (1 - i * 0.13) * (0.9 + rand() * 0.2);
    const lh = 14 + rand() * 16;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(lw, lh, lw * (0.7 + rand() * 0.3)),
      new THREE.MeshStandardMaterial({ color: 0x120704, roughness: 0.95, metalness: 0.05 }),
    );
    slab.position.y = y + lh / 2;
    slab.rotation.y = (rand() - 0.5) * 0.3;
    g.add(slab);
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(lw * 1.02, 0.3, lw * 0.73),
      new THREE.MeshBasicMaterial({ color: theme.edgeLeft, transparent: true, opacity: 0.5 }),
    );
    seam.position.y = y + lh;
    seam.rotation.y = slab.rotation.y;
    g.add(seam);
    y += lh;
  }
  return g;
}

/** Classic saucer: disc + dome + glow ring; hovers, sways, some carry beams. */
export function ufo(rand: Rand, color: number): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 4.4, 0.9, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.3, metalness: 0.9 }),
  );
  g.add(disc);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }),
  );
  dome.position.y = 0.45;
  g.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.16, 6, 20), new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.3;
  g.add(ring);
  if (rand() < 0.45) {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 14, 10, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = -7.4;
    beam.userData.beam = true;
    g.add(beam);
  }
  g.userData.creature = "ufo";
  g.userData.phase = rand() * 10;
  return g;
}
