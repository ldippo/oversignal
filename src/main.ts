import * as THREE from "three";
import { GameLoop } from "./core/loop";
import { makeFrame } from "./track/spline";
import { buildTrackMesh, disposeGroup } from "./track/mesh";
import { generateSegment, type Segment } from "./track/generator";
import { FeatureField } from "./track/features";
import { PostFx } from "./fx/post";
import { themeFor } from "./fx/palette";
import { Ship, BASE_STATS } from "./ship/ship";
import { loadSave, bankRun } from "./core/save";
import { draftUpgrades } from "./game/upgrades";
import { showUpgradeDraft } from "./ui/screens";
import { attachInput, readInput } from "./ship/input";
import { Run } from "./game/run";
import { Hud } from "./ui/hud";
import { MusicState } from "./audio/music-state";
import { captureTab, captureMic, silentSource, type AudioSourceKind } from "./audio/capture";
import { showMenu } from "./ui/screens";
import { AudioDebug } from "./ui/audio-debug";

// ---------- renderer / scene ----------

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030308);
scene.fog = new THREE.Fog(0x050514, 60, 520);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);

const post = new PostFx(renderer, scene, camera);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0x445577, 1.6));
const sun = new THREE.DirectionalLight(0x88aaff, 1.8);
sun.position.set(200, 400, 100);
scene.add(sun);

// starfield (follows ship so the sky never runs out)
const stars = (() => {
  const N = 3000;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 900 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) - 200;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 1.6, sizeAttenuation: true, fog: false });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return points;
})();

// ---------- game state ----------

type GameState = "menu" | "run" | "upgrade" | "gameover";
let state: GameState = "menu";
const save = loadSave();

let run = new Run((Math.random() * 0xffffffff) >>> 0);
let segment: Segment | null = null;
let trackGroup: THREE.Group | null = null;
let features: FeatureField | null = null;
let elapsed = 0;
let wasDropActive = false;

const ship = new Ship(generateSegment({ seed: 1, difficulty: 0 }).spline, 14);
scene.add(ship.object);
attachInput();

const ui = document.getElementById("ui")!;
const hud = new Hud(ui);
const music = new MusicState();
const audioDebug = new AudioDebug(ui);
let overlay: HTMLDivElement | null = null;

async function pickAudio(kind: AudioSourceKind): Promise<void> {
  const cap = kind === "tab" ? await captureTab() : kind === "mic" ? await captureMic() : silentSource();
  music.setCapture(cap);
}

function startSegment(): void {
  if (trackGroup) disposeGroup(trackGroup);
  if (features) disposeGroup(features.group);
  const theme = themeFor(run.segmentIndex);
  segment = generateSegment({ seed: run.segmentSeed(), difficulty: run.segmentIndex });
  trackGroup = buildTrackMesh(segment.spline, {
    halfWidth: segment.halfWidth,
    edgeColorLeft: theme.edgeLeft,
    edgeColorRight: theme.edgeRight,
  });
  scene.add(trackGroup);
  features = new FeatureField(segment, theme);
  scene.add(features.group);
  scene.fog = new THREE.Fog(theme.fog, 60, 520);
  scene.background = new THREE.Color(theme.background);
  ship.setSpline(segment.spline, segment.halfWidth);
  ship.s = 0;
  ship.lateral = 0;
  ship.speed = Math.min(ship.speed, 40);
  run.shields = run.mods.shieldPerSegment;
  camInit = false;
  hud.flashBanner(`SECTOR ${run.segmentIndex + 1}`, 2);
}

function finishSegment(): void {
  run.segmentIndex++;
  run.addScore(500);
  state = "upgrade";
  showUpgradeDraft(ui, run.segmentIndex, draftUpgrades(3), (u) => {
    u.apply(run, ship);
    state = "run";
    startSegment();
  });
}

function gameOver(): void {
  state = "gameover";
  const payout = run.payout();
  bankRun(save, payout, run.score);
  overlay = document.createElement("div");
  overlay.className = "screen";
  overlay.innerHTML = `
    <h2>SHIP DESTROYED</h2>
    <div class="stat">SECTOR ${run.segmentIndex + 1} · SCORE ${Math.floor(run.score)} · BEST COMBO ×${run.bestCombo}</div>
    <div class="stat">SCRAP +${payout} → ${save.scrap} BANKED</div>
    <button id="retry">RETRY [R]</button>
    <button id="menu" class="secondary">CHANGE MUSIC / MENU</button>
  `;
  ui.appendChild(overlay);
  overlay.querySelector("#retry")!.addEventListener("click", restart);
  overlay.querySelector("#menu")!.addEventListener("click", () => window.location.reload());
}

function restart(): void {
  overlay?.remove();
  overlay = null;
  run = new Run((Math.random() * 0xffffffff) >>> 0);
  ship.stats = { ...BASE_STATS };
  ship.speed = 0;
  state = "run";
  startSegment();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && state === "gameover") restart();
});

// ---------- camera ----------

const camFrame = makeFrame();
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
let camInit = false;

function updateCamera(dt: number): void {
  if (!segment) return;
  segment.spline.frameAt(ship.s, camFrame);
  const desired = camPos
    .copy(ship.object.position)
    .addScaledVector(camFrame.tangent, -13)
    .addScaledVector(camFrame.up, 5.5);
  if (!camInit) {
    camera.position.copy(desired);
    camInit = true;
  } else {
    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(desired, k);
  }
  camTarget.copy(ship.object.position).addScaledVector(camFrame.tangent, 14);
  camera.up.copy(camFrame.up);
  camera.lookAt(camTarget);
  // bass rumble
  const shake = music.bass * 0.22 + (music.dropActive ? 0.2 : 0);
  camera.position.x += (Math.random() - 0.5) * shake;
  camera.position.y += (Math.random() - 0.5) * shake;
  stars.position.copy(ship.object.position);
}

// ---------- loop ----------

const WALL_DPS = 16;

const loop = new GameLoop(
  (dt) => {
    if (state !== "run" || !segment || !features) return;
    elapsed += dt;
    music.update(dt);

    if (music.dropActive && !wasDropActive) hud.flashBanner("OVERDRIVE", 2.5);
    wasDropActive = music.dropActive;

    const input = readInput();
    const prevS = ship.s;
    const speedScale = 0.85 + music.energy * 0.4 + (music.dropActive ? 0.35 : 0);
    ship.update(dt, input, speedScale);
    run.distance += ship.s - prevS;
    run.addScore((ship.s - prevS) * 0.15);

    for (const ev of features.check(prevS, ship.s, ship.lateral, run.mods.magnetRadius)) {
      if (ev.kind === "gate") {
        if (music.onBeat(run.mods.rhythmWindow)) {
          run.combo++;
          run.bestCombo = Math.max(run.bestCombo, run.combo);
          run.addScore(120);
          run.heal(run.mods.hullRegenOnBeat);
          ship.applyBoost(0.42 * run.mods.boostPower, 1.6);
          hud.flashBanner(`PERFECT ×${run.combo}`, 0.6);
        } else {
          run.combo = 0;
          run.addScore(40);
          ship.applyBoost(0.16 * run.mods.boostPower, 0.8);
        }
      } else if (ev.kind === "obstacle") {
        if (!music.dropActive) {
          run.damage(18);
          ship.speed *= 0.6;
          run.combo = 0;
        }
      } else if (ev.kind === "scrap") {
        run.addScrap(5);
        run.addScore(25);
      }
    }

    if (ship.hitWall) {
      run.damage(WALL_DPS * (0.3 + (ship.speed / ship.stats.maxSpeed) * 0.7) * dt);
      run.combo = 0;
    }
    if (run.over) {
      gameOver();
      return;
    }
    if (ship.s >= segment.spline.length - 2) {
      finishSegment();
    }
    updateCamera(dt);
  },
  (_, ) => {
    features?.animate(music.beatPulse, elapsed);
    const targetFov = 72 + music.energy * 8 + music.beatPulse * 2 + (music.dropActive ? 6 : 0);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
    post.update(music.energy, music.beatPulse, music.dropActive);
    hud.update(run, ship.speed * 3.6, 1 / 60);
    audioDebug.update(music);
    post.render();
  },
);

hud.setVisible(false);
showMenu(ui, save, async (kind) => {
  await pickAudio(kind);
  hud.setVisible(true);
  state = "run";
  startSegment();
});
loop.start();

// dev/test hook (harmless in prod; lets automation poke game state)
Object.assign(window as unknown as Record<string, unknown>, {
  __game: {
    get state() { return state; },
    get run() { return run; },
    get ship() { return ship; },
    music,
  },
});
