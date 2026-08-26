import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export class PostFx {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.6, // strength (driven per-frame)
      0.55, // radius
      0.2, // threshold — low so emissive rails/gates glow
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  /** energy 0..1, beatPulse 0..1, overdrive flag → bloom intensity */
  update(energy: number, beatPulse: number, overdrive: boolean): void {
    this.bloom.strength = 0.35 + energy * 0.7 + beatPulse * 0.45 + (overdrive ? 0.9 : 0);
  }

  render(): void {
    this.composer.render();
  }
}
