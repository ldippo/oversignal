import * as THREE from "three";

const PARTICLE_COUNT = 600;
const GRAVITY = -14;

/**
 * Arcade-loud feedback layer: pooled particles, shockwaves, camera feel,
 * floating score text, damage vignette, rail strobe. One instance, wired
 * from main's event switch. All effects are fire-and-forget.
 */
export class Juice {
  // camera feel — read by main's camera code each frame
  fovKick = 0;
  camKick = 0; // backward pull along tangent
  shake = 0;
  /** Adaptive loudness: fx scale with music energy (0.55 quiet … ~1.2 chorus). */
  intensity = 1;
  // accessibility gates (settings)
  shakeEnabled = true;
  flashesEnabled = true;

  setIntensity(energy: number): void {
    this.intensity = 0.55 + energy * 0.7;
  }

  setAccessibility(shake: boolean, flashes: boolean): void {
    this.shakeEnabled = shake;
    this.flashesEnabled = flashes;
  }

  private particles: THREE.Points;
  private pPos: Float32Array;
  private pVel: Float32Array;
  private pLife: Float32Array;
  private pColor: Float32Array;
  private pCursor = 0;

  private waves: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number }[] = [];
  private strobeLines: THREE.LineBasicMaterial[] = [];
  private strobeColors: THREE.Color[] = [];
  private strobeT = 0;

  private textLayer: HTMLDivElement;

  constructor(private scene: THREE.Scene, ui: HTMLElement) {
    this.pPos = new Float32Array(PARTICLE_COUNT * 3).fill(-9999);
    this.pVel = new Float32Array(PARTICLE_COUNT * 3);
    this.pLife = new Float32Array(PARTICLE_COUNT);
    this.pColor = new Float32Array(PARTICLE_COUNT * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.pColor, 3));
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.55,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.particles.frustumCulled = false;
    scene.add(this.particles);

    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 40), mat);
      mesh.visible = false;
      scene.add(mesh);
      this.waves.push({ mesh, mat, life: 0 });
    }

    this.textLayer = document.createElement("div");
    this.textLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    ui.appendChild(this.textLayer);
  }

  /** Spray count particles from pos. spread = velocity randomness, dir = bias. */
  burst(pos: THREE.Vector3, count: number, color: number, speed = 14, dir?: THREE.Vector3): void {
    const c = new THREE.Color(color);
    const scaled = Math.max(2, Math.round(count * this.intensity));
    for (let n = 0; n < scaled; n++) {
      const i = this.pCursor;
      this.pCursor = (this.pCursor + 1) % PARTICLE_COUNT;
      this.pPos[i * 3] = pos.x;
      this.pPos[i * 3 + 1] = pos.y;
      this.pPos[i * 3 + 2] = pos.z;
      this.pVel[i * 3] = (Math.random() - 0.5) * speed + (dir?.x ?? 0);
      this.pVel[i * 3 + 1] = Math.random() * speed * 0.7 + (dir?.y ?? 0);
      this.pVel[i * 3 + 2] = (Math.random() - 0.5) * speed + (dir?.z ?? 0);
      this.pLife[i] = 0.6 + Math.random() * 0.5;
      this.pColor[i * 3] = c.r;
      this.pColor[i * 3 + 1] = c.g;
      this.pColor[i * 3 + 2] = c.b;
    }
  }

  /** Expanding ring at pos, oriented by quaternion (faces down-track). */
  shockwave(pos: THREE.Vector3, quaternion: THREE.Quaternion, color: number, maxRadius = 18): void {
    const w = this.waves.find((x) => x.life <= 0);
    if (!w) return;
    w.life = 1;
    w.mesh.visible = true;
    w.mesh.position.copy(pos);
    w.mesh.quaternion.copy(quaternion);
    w.mesh.scale.setScalar(0.1);
    w.mesh.userData.maxRadius = maxRadius;
    w.mat.color.set(color);
    w.mat.opacity = 0.9;
  }

  kick(strength: number): void {
    const s = strength * this.intensity;
    this.fovKick = Math.min(14, this.fovKick + s * 10);
    this.camKick = Math.min(4, this.camKick + s * 2.5);
  }

  rumble(strength: number): void {
    if (!this.shakeEnabled) return;
    this.shake = Math.min(1.2, this.shake + strength * this.intensity);
  }

  /** Floating score text at a world position (projected once, CSS animates). */
  floatText(worldPos: THREE.Vector3, camera: THREE.Camera, text: string, color = "#e8f6ff"): void {
    const p = worldPos.clone().project(camera);
    if (p.z > 1) return; // behind camera
    const el = document.createElement("div");
    el.className = "float-text";
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${((p.x + 1) / 2) * 100}%`;
    el.style.top = `${((1 - p.y) / 2) * 100}%`;
    this.textLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  /** Damage flash: red glitch vignette (CSS-driven). */
  damageFlash(): void {
    if (!this.flashesEnabled) return;
    const el = document.createElement("div");
    el.className = "damage-vignette";
    this.textLayer.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  /** Register the current track's rail line materials for strobing. */
  setRails(trackGroup: THREE.Group): void {
    this.strobeLines = [];
    this.strobeColors = [];
    trackGroup.traverse((obj) => {
      if ((obj as THREE.Line).isLine) {
        const mat = (obj as THREE.Line).material as THREE.LineBasicMaterial;
        this.strobeLines.push(mat);
        this.strobeColors.push(mat.color.clone());
      }
    });
  }

  strobeRails(): void {
    if (!this.flashesEnabled) return;
    this.strobeT = 1;
  }

  update(dt: number): void {
    // particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        this.pPos[i * 3 + 1] = -9999;
        continue;
      }
      this.pVel[i * 3 + 1] += GRAVITY * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      const fade = Math.min(1, this.pLife[i] * 2.5);
      this.pColor[i * 3] *= 0.9 + fade * 0.1;
      this.pColor[i * 3 + 1] *= 0.9 + fade * 0.1;
      this.pColor[i * 3 + 2] *= 0.9 + fade * 0.1;
    }
    (this.particles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.particles.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // shockwaves
    for (const w of this.waves) {
      if (w.life <= 0) continue;
      w.life -= dt * 1.6;
      if (w.life <= 0) {
        w.mesh.visible = false;
        continue;
      }
      const t = 1 - w.life;
      w.mesh.scale.setScalar(0.1 + t * (w.mesh.userData.maxRadius as number));
      w.mat.opacity = w.life * 0.9;
    }

    // camera feel decay
    const k = Math.exp(-8 * dt);
    this.fovKick *= k;
    this.camKick *= k;
    this.shake *= Math.exp(-6 * dt);

    // rail strobe decay
    if (this.strobeT > 0) {
      this.strobeT = Math.max(0, this.strobeT - dt * 3);
      for (let i = 0; i < this.strobeLines.length; i++) {
        this.strobeLines[i].color.copy(this.strobeColors[i]).lerp(WHITE, this.strobeT);
      }
    }
  }
}

const WHITE = new THREE.Color(0xffffff);
