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

/** 3-6 edge-lit crystals; replaces rocks. Drift/spin via userData.spin. */
export function shardCluster(rand: Rand, theme: SectorTheme): THREE.Group {
  const g = new THREE.Group();
  const count = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.OctahedronGeometry(1);
    geo.scale(0.7 + rand(), 1.2 + rand() * 1.6, 0.7 + rand());
    const core = new THREE.Mesh(geo, darkMat());
    core.position.set((rand() - 0.5) * 7, (rand() - 0.5) * 5, (rand() - 0.5) * 7);
    core.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    g.add(core);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: theme.scrap, transparent: true, opacity: 0.55 }),
    );
    edges.position.copy(core.position);
    edges.rotation.copy(core.rotation);
    g.add(edges);
  }
  g.userData.spin = (rand() - 0.5) * 0.4;
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
