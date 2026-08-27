import * as THREE from "three";
import { buildShipMesh } from "../ship/ship";
import type { ShipDef } from "../game/ships";

/**
 * Small dedicated renderer for the hangar: the selected ship's model on a
 * transparent canvas, slow turntable spin + hover bob. Cheap (one draw of a
 * handful of primitives) and isolated from the attract-mode world behind.
 */
export class ShipPreview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mesh: THREE.Group | null = null;
  private raf = 0;
  private disposed = false;

  constructor(width = 300, height = 170) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "ship-preview";
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    this.camera.position.set(0, 2.6, 7.2);
    this.camera.lookAt(0, 0.2, 0);
    this.scene.add(new THREE.AmbientLight(0x445577, 1.8));
    const key = new THREE.DirectionalLight(0x88aaff, 2.4);
    key.position.set(4, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3ec8, 1.2);
    rim.position.set(-5, 2, -4);
    this.scene.add(rim);

    const tick = (now: number): void => {
      if (this.disposed) return;
      if (this.mesh) {
        const t = now * 0.001;
        this.mesh.rotation.y = t * 0.7;
        this.mesh.position.y = Math.sin(t * 1.6) * 0.12;
      }
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setShip(def: ShipDef): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    }
    this.mesh = buildShipMesh(def);
    this.scene.add(this.mesh);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
}
