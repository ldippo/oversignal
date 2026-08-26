import * as THREE from "three";
import type { SectorTheme } from "./palette";
import type { MusicState } from "../audio/music-state";

function gradientTexture(horizon: number, zenith: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  const h = new THREE.Color(horizon);
  const z = new THREE.Color(zenith);
  grad.addColorStop(0, `#${h.getHexString()}`);
  grad.addColorStop(0.45, `#${h.clone().lerp(z, 0.7).getHexString()}`);
  grad.addColorStop(1, `#${z.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const OVERDRIVE_TINT = new THREE.Color(0xff3ec8);

/** Sky dome + celestial body; follows the ship, reacts to the music. */
export class Environment {
  private dome: THREE.Mesh;
  private domeMat: THREE.MeshBasicMaterial;
  private celestial: THREE.Mesh;
  private celestialMat: THREE.MeshBasicMaterial;
  private celestialBase = new THREE.Color();
  private celestialDir = new THREE.Vector3(0, 0.3, -1);
  private baseTint = new THREE.Color(1, 1, 1);

  constructor(scene: THREE.Scene) {
    this.domeMat = new THREE.MeshBasicMaterial({
      map: gradientTexture(0x0e1440, 0x020208),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1700, 24, 16), this.domeMat);
    this.dome.renderOrder = -2;
    scene.add(this.dome);

    this.celestialMat = new THREE.MeshBasicMaterial({ color: 0x8a4eff, fog: false });
    this.celestial = new THREE.Mesh(new THREE.SphereGeometry(110, 5, 4), this.celestialMat);
    this.celestial.renderOrder = -1;
    scene.add(this.celestial);
  }

  setTheme(theme: SectorTheme): void {
    this.domeMat.map?.dispose();
    this.domeMat.map = gradientTexture(theme.skyHorizon, theme.skyZenith);
    this.domeMat.needsUpdate = true;
    this.celestialBase.set(theme.celestial);
    this.celestialDir.fromArray(theme.celestialDir).normalize();
  }

  update(music: MusicState, shipPos: THREE.Vector3): void {
    this.dome.position.copy(shipPos);
    this.celestial.position.copy(shipPos).addScaledVector(this.celestialDir, 1300);

    // energy brightens the sky; OVERDRIVE tints it hot pink
    const brightness = 0.75 + music.energy * 0.5;
    this.baseTint.setScalar(brightness);
    if (music.dropActive) this.baseTint.lerp(OVERDRIVE_TINT, 0.35);
    this.domeMat.color.copy(this.baseTint);

    const pulse = 1 + music.beatPulse * 0.06;
    this.celestial.scale.setScalar(pulse);
    this.celestialMat.color.copy(this.celestialBase).multiplyScalar(0.9 + music.beatPulse * 0.4);
  }
}
