import * as THREE from "three";
import type { SectorTheme } from "./palette";
import type { MusicState } from "../audio/music-state";

function streakTexture(color: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#020208";
  ctx.fillRect(0, 0, 256, 256);
  const c = new THREE.Color(color);
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 256;
    const len = 30 + Math.random() * 120;
    const y = Math.random() * 256;
    const alpha = 0.25 + Math.random() * 0.6;
    ctx.strokeStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${alpha})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  return tex;
}

/**
 * Endless neon tunnel around the ship between sectors. Cheap: one cylinder,
 * scrolling emissive streak texture, slight roll. Upgrade draft renders on top.
 */
export class WarpTunnel {
  private mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private forward: THREE.Vector3;

  constructor(
    private scene: THREE.Scene,
    private ship: THREE.Object3D,
    theme: SectorTheme,
  ) {
    this.mat = new THREE.MeshBasicMaterial({
      map: streakTexture(theme.gate),
      side: THREE.BackSide,
      fog: false,
      transparent: true,
      opacity: 0.95,
    });
    const geo = new THREE.CylinderGeometry(13, 13, 500, 24, 1, true);
    this.mesh = new THREE.Mesh(geo, this.mat);
    // cylinder axis is Y; align with ship forward
    this.forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.forward);
    this.mesh.position.copy(ship.position);
    scene.add(this.mesh);
  }

  update(dt: number, music: MusicState): void {
    const tex = this.mat.map!;
    tex.offset.y -= dt * (2.2 + music.energy * 2.5); // scroll = speed illusion
    this.mesh.rotateOnWorldAxis(this.forward, dt * 0.25);
    this.mesh.position.copy(this.ship.position);
    // gentle ship bob so the warp doesn't feel frozen
    this.ship.rotation.z = Math.sin(performance.now() * 0.0012) * 0.08;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.map?.dispose();
    this.mat.dispose();
  }
}
