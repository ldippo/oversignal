import * as THREE from "three";
import { TrackSpline, makeFrame } from "./spline";

export interface TrackMeshOptions {
  halfWidth: number;
  sampleStep: number; // meters between cross-sections
  surfaceColor: number;
  edgeColorLeft: number;
  edgeColorRight: number;
  startDist?: number; // build only [startDist, endDist] of the spline
  endDist?: number;
}

const DEFAULTS: TrackMeshOptions = {
  halfWidth: 14,
  sampleStep: 3,
  surfaceColor: 0x0a0e1e,
  edgeColorLeft: 0x4ef3ff,
  edgeColorRight: 0xff3ec8,
};

function makeSurfaceTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b1024";
  ctx.fillRect(0, 0, size, size);
  // faint longitudinal lanes
  ctx.strokeStyle = "rgba(90, 130, 220, 0.18)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const x = (size / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  // transverse pulse line
  ctx.fillStyle = "rgba(120, 200, 255, 0.35)";
  ctx.fillRect(0, 0, size, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

let surfaceTex: THREE.Texture | null = null;

/**
 * Builds track geometry: road ribbon, glowing edge rails, low containment walls.
 * Returns a Group; caller owns disposal (dispose() walks children).
 */
export function buildTrackMesh(spline: TrackSpline, opts?: Partial<TrackMeshOptions>): THREE.Group {
  const o = { ...DEFAULTS, ...opts };
  const start = o.startDist ?? 0;
  const end = o.endDist ?? spline.length;
  const span = end - start;
  const steps = Math.max(2, Math.ceil(span / o.sampleStep));

  const frame = makeFrame();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const railL: number[] = [];
  const railR: number[] = [];
  const wallPositions: number[] = [];
  const wallIndices: number[] = [];

  const RAIL_H = 0.35;
  const WALL_H = 1.6;

  for (let i = 0; i <= steps; i++) {
    const d = start + (span * i) / steps;
    spline.frameAt(d, frame);
    const { position: p, right, up } = frame;

    const lx = p.x - right.x * o.halfWidth;
    const ly = p.y - right.y * o.halfWidth;
    const lz = p.z - right.z * o.halfWidth;
    const rx = p.x + right.x * o.halfWidth;
    const ry = p.y + right.y * o.halfWidth;
    const rz = p.z + right.z * o.halfWidth;

    positions.push(lx, ly, lz, rx, ry, rz);
    normals.push(up.x, up.y, up.z, up.x, up.y, up.z);
    const v = d / 12; // texture repeat every 12m
    uvs.push(0, v, 1, v);

    railL.push(lx, ly + RAIL_H, lz);
    railR.push(rx, ry + RAIL_H, rz);

    // wall quads: vertical strips just outside each edge
    wallPositions.push(
      lx, ly, lz, lx - right.x * 0.4, ly + WALL_H, lz - right.z * 0.4,
      rx, ry, rz, rx + right.x * 0.4, ry + WALL_H, rz + right.z * 0.4,
    );

    if (i < steps) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      const w = i * 4;
      wallIndices.push(w, w + 1, w + 4, w + 1, w + 5, w + 4);
      wallIndices.push(w + 2, w + 6, w + 3, w + 3, w + 6, w + 7);
    }
  }

  const group = new THREE.Group();

  const surfGeo = new THREE.BufferGeometry();
  surfGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  surfGeo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  surfGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  surfGeo.setIndex(indices);
  if (!surfaceTex) surfaceTex = makeSurfaceTexture();
  const surfMat = new THREE.MeshStandardMaterial({
    color: o.surfaceColor,
    map: surfaceTex,
    roughness: 0.85,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(surfGeo, surfMat));

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wallPositions, 3));
  wallGeo.setIndex(wallIndices);
  wallGeo.computeVertexNormals();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x101830,
    roughness: 0.6,
    metalness: 0.4,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(wallGeo, wallMat));

  const railGeoL = new THREE.BufferGeometry();
  railGeoL.setAttribute("position", new THREE.Float32BufferAttribute(railL, 3));
  const railGeoR = new THREE.BufferGeometry();
  railGeoR.setAttribute("position", new THREE.Float32BufferAttribute(railR, 3));
  const railMatL = new THREE.LineBasicMaterial({ color: o.edgeColorLeft });
  const railMatR = new THREE.LineBasicMaterial({ color: o.edgeColorRight });
  group.add(new THREE.Line(railGeoL, railMatL));
  group.add(new THREE.Line(railGeoR, railMatR));

  return group;
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
  group.parent?.remove(group);
}
