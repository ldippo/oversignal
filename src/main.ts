import * as THREE from "three";
import { GameLoop } from "./core/loop";
import { makeFrame } from "./track/spline";
import { buildTrackMesh, disposeGroup } from "./track/mesh";
import { generateSegment, type Segment } from "./track/generator";
import { FeatureField } from "./track/features";
import { PostFx } from "./fx/post";
import { themeFor } from "./fx/palette";
import { Environment } from "./fx/environment";
import { WarpTunnel } from "./fx/warp";
import { Juice } from "./fx/juice";
import { ShipTrails } from "./fx/trail";
import { Ship } from "./ship/ship";
import { loadSave, bankRun } from "./core/save";
import { draftUpgrades } from "./game/upgrades";
import { shipById } from "./game/ships";
import { moduleById } from "./game/modules";
import { showUpgradeDraft } from "./ui/screens";
import { showHangar } from "./ui/hangar";
import { attachInput, readInput } from "./ship/input";
import { Run } from "./game/run";
import { Hud } from "./ui/hud";
import { MusicState } from "./audio/music-state";
import { captureTab, captureMic, silentSource, type AudioSourceKind } from "./audio/capture";
import { showMenu } from "./ui/screens";
import { AudioDebug } from "./ui/audio-debug";
import { NowPlayingHud } from "./ui/now-playing";
import { handleRedirect } from "./audio/spotify";

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

const environment = new Environment(scene);

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

type GameState = "menu" | "run" | "warp" | "gameover";
let state: GameState = "menu";
const save = loadSave();

let run = new Run((Math.random() * 0xffffffff) >>> 0);
let segment: Segment | null = null;
let trackGroup: THREE.Group | null = null;
let features: FeatureField | null = null;
let warp: WarpTunnel | null = null;
let elapsed = 0;
let wasDropActive = false;
let fenceOpenNow = false;
let ringChain = 0;
let chainForgive = 0;

const ship = new Ship(generateSegment({ seed: 1, difficulty: 0 }).spline, 14);
scene.add(ship.object);
attachInput();

const ui = document.getElementById("ui")!;
const hud = new Hud(ui);
const music = new MusicState();
const audioDebug = new AudioDebug(ui);
const nowPlaying = new NowPlayingHud(ui);
const juice = new Juice(scene, ui);
const trails = new ShipTrails(scene, 0x4ef3ff);
let currentTheme = themeFor(0);
let overlay: HTMLDivElement | null = null;

async function pickAudio(kind: AudioSourceKind): Promise<void> {
  const cap = kind === "tab" ? await captureTab() : kind === "mic" ? await captureMic() : silentSource();
  music.setCapture(cap);
}

function startSegment(): void {
  if (trackGroup) disposeGroup(trackGroup);
  if (features) disposeGroup(features.group);
  const theme = themeFor(run.segmentIndex);
  currentTheme = theme;
  segment = generateSegment({ seed: run.segmentSeed(), difficulty: run.segmentIndex });
  trackGroup = buildTrackMesh(segment.spline, {
    halfWidth: segment.halfWidth,
    edgeColorLeft: theme.edgeLeft,
    edgeColorRight: theme.edgeRight,
  });
  scene.add(trackGroup);
  features = new FeatureField(segment, theme, {
    beatConfidence: music.beatConfidence,
    bpm: music.bpm,
  });
  scene.add(features.group);
  scene.fog = new THREE.Fog(theme.fog, 60, 650);
  scene.background = new THREE.Color(theme.background);
  environment.setTheme(theme);
  juice.setRails(trackGroup);
  trails.setColor(ship.def.accent);
  ringChain = 0;
  chainForgive = run.mods.chainKeeper ? 1 : 0;
  ship.setSpline(segment.spline, segment.halfWidth);
  ship.s = 0;
  ship.lateral = 0;
  ship.speed = Math.min(ship.speed, 40);
  run.shields = run.mods.shieldPerSegment;
  camInit = false;
  hud.flashBanner(`SECTOR ${run.segmentIndex + 1}`, 2);
}

function flash(): void {
  const el = document.createElement("div");
  el.className = "flash";
  ui.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function finishSegment(): void {
  run.segmentIndex++;
  run.addScore(500);
  state = "warp";
  flash();
  hud.flashBanner("SECTOR CLEAR", 1.5);
  juice.shockwave(ship.object.position, ship.object.quaternion, 0xffffff, 40);
  juice.kick(1);
  // old world drops away; the warp tunnel hides the rebuild
  if (trackGroup) { disposeGroup(trackGroup); trackGroup = null; }
  if (features) { disposeGroup(features.group); features = null; }
  warp = new WarpTunnel(scene, ship.object, themeFor(run.segmentIndex - 1));
  showUpgradeDraft(ui, run.segmentIndex, draftUpgrades(run, 3), (u) => {
    u.apply(run, ship);
    warp?.dispose();
    warp = null;
    flash();
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

/** Fresh run with the selected ship's stats + socketed modules applied. */
function newRun(): Run {
  const def = shipById(save.selectedShip);
  ship.setDef(def);
  const r = new Run((Math.random() * 0xffffffff) >>> 0);
  r.mods.hullMax = Math.max(30, r.mods.hullMax + def.stats.hullDelta);
  r.mods.rhythmWindow += def.stats.rhythmDelta;
  r.mods.boostPower += def.stats.boostDelta;
  r.mods.shieldPerSegment += def.stats.shieldPerSegment;
  r.mods.magnetRadius += def.stats.magnetDelta;
  for (const id of save.loadouts[save.selectedShip] ?? []) {
    moduleById(id)?.apply(r.mods);
  }
  r.hull = r.mods.hullMax;
  r.dashPips = Math.min(3, r.mods.maxPips);
  return r;
}

function restart(): void {
  overlay?.remove();
  overlay = null;
  run = newRun();
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
  // bass rumble + event shake + hit kick
  camera.position.addScaledVector(camFrame.tangent, -juice.camKick);
  const shake = music.bass * 0.22 + (music.dropActive ? 0.2 : 0) + juice.shake * 0.5;
  camera.position.x += (Math.random() - 0.5) * shake;
  camera.position.y += (Math.random() - 0.5) * shake;
  stars.position.copy(ship.object.position);
}

// ---------- loop ----------

const WALL_DPS = 16;

const loop = new GameLoop(
  (dt) => {
    if (state === "warp") {
      elapsed += dt;
      music.update(dt);
      juice.update(dt);
      warp?.update(dt, music);
      return;
    }
    if (state !== "run" || !segment || !features) return;
    elapsed += dt;
    music.update(dt);

    juice.update(dt);
    if (music.dropActive && !wasDropActive) {
      hud.flashBanner("OVERDRIVE", 2.5);
      juice.shockwave(ship.object.position, ship.object.quaternion, 0xffffff, 30);
      juice.strobeRails();
      juice.kick(0.8);
      music.dropTimer += run.mods.dropExtend;
      if (run.mods.odCharger) run.dashPips = run.mods.maxPips;
    }
    wasDropActive = music.dropActive;

    fenceOpenNow = features.hasFences
      ? music.onBeat(features.fenceWindowFrac * 0.5 * (60 / music.bpm))
      : false;

    const input = readInput();
    if (input.dash && !ship.dashing && run.dashPips >= 1) {
      run.dashPips -= 1;
      ship.dash();
      juice.kick(0.6);
      juice.burst(ship.object.position, 16, ship.def.accent, 18);
    }
    const prevS = ship.s;
    const speedScale = 0.85 + music.energy * 0.4 + (music.dropActive ? 0.35 : 0);
    ship.update(dt, input, speedScale);
    run.distance += ship.s - prevS;
    run.addScore((ship.s - prevS) * 0.15);

    for (const ev of features.check(prevS, ship.s, ship.lateral, run.mods.magnetRadius)) {
      const fpos = ev.feature.mesh.position;
      if (ev.kind === "gate") {
        if (music.onBeat(run.mods.rhythmWindow)) {
          run.combo++;
          run.bestCombo = Math.max(run.bestCombo, run.combo);
          run.addScore(120);
          run.heal(run.mods.hullRegenOnBeat);
          run.earnPip(1);
          ship.applyBoost(0.42 * run.mods.boostPower, 1.6);
          hud.flashBanner(`PERFECT ×${run.combo}`, 0.6);
          juice.shockwave(fpos, ev.feature.mesh.quaternion, currentTheme.gate, 22);
          juice.burst(fpos, 20, 0xffffff, 20);
          juice.kick(0.5);
          juice.floatText(fpos, camera, "+120", "#fff");
        } else {
          run.combo = 0;
          run.addScore(40);
          ship.applyBoost(0.16 * run.mods.boostPower, 0.8);
          juice.kick(0.2);
          juice.floatText(fpos, camera, "+40");
        }
      } else if (ev.kind === "shard" || ev.kind === "barrier") {
        if (ship.dashing) {
          run.addScore(150);
          hud.flashBanner("SHATTER", 0.4);
          juice.burst(fpos, 26, currentTheme.obstacle, 26);
          juice.shockwave(fpos, ev.feature.mesh.quaternion, currentTheme.obstacle, 14);
          juice.kick(0.4);
          loop.freeze(0.04);
          juice.floatText(fpos, camera, "+150 SHATTER", "#ffc44e");
          if (run.mods.pipSiphon) run.earnPip(run.mods.pipSiphonAmount);
          if (run.mods.shatterwave) {
            // detonate hazards just ahead of the shatter point
            for (const other of features.features) {
              if (other.taken || other === ev.feature) continue;
              if (other.kind !== "shard" && other.kind !== "barrier") continue;
              if (other.s < ev.feature.s || other.s > ev.feature.s + run.mods.shatterwaveRadius) continue;
              other.taken = true;
              other.mesh.visible = false;
              run.addScore(100);
              juice.burst(other.mesh.position, 16, currentTheme.obstacle, 20);
              if (run.mods.pipSiphon) run.earnPip(run.mods.pipSiphonAmount);
            }
          }
        } else if (!music.dropActive) {
          run.damage(18);
          ship.speed *= 0.6;
          run.combo = 0;
          juice.burst(ship.object.position, 18, 0xff4030, 16);
          juice.damageFlash();
          juice.rumble(0.8);
          loop.freeze(0.06);
          juice.floatText(ship.object.position, camera, "-18", "#ff5a5a");
        }
      } else if (ev.kind === "fence") {
        if (fenceOpenNow || music.dropActive || ship.dashing) {
          run.addScore(60);
          juice.burst(fpos, 10, currentTheme.obstacle, 10);
          juice.floatText(fpos, camera, "+60");
        } else {
          run.damage(14);
          ship.speed *= 0.7;
          run.combo = 0;
          juice.damageFlash();
          juice.rumble(0.6);
          juice.floatText(ship.object.position, camera, "-14", "#ff5a5a");
        }
      } else if (ev.kind === "ring") {
        if (ev.collected) {
          ringChain++;
          run.addScrap(5 * run.mods.ringScrapMult);
          run.addScore(25);
          juice.burst(fpos, 8, currentTheme.scrap, 10);
          if (ringChain % 5 === 0) {
            run.addScrap(15 * run.mods.chainBonusMult);
            run.addScore(100 * run.mods.chainBonusMult);
            run.earnPip(1);
            chainForgive = run.mods.chainKeeper ? 1 : 0;
            hud.flashBanner(`CHAIN ${ringChain}`, 0.5);
            juice.strobeRails();
            juice.floatText(fpos, camera, `CHAIN ${ringChain} +${Math.round(100 * run.mods.chainBonusMult)}`, "#ffc44e");
          }
        } else if (chainForgive > 0) {
          chainForgive--;
          juice.floatText(ship.object.position, camera, "CHAIN KEPT", "#8aff6a");
        } else {
          ringChain = 0;
        }
      }
    }

    if (ship.hitWall) {
      run.damage(WALL_DPS * (0.3 + (ship.speed / ship.stats.maxSpeed) * 0.7) * dt);
      run.combo = 0;
      if (Math.random() < dt * 40) {
        juice.burst(ship.object.position, 2, 0xffaa55, 9);
      }
      juice.rumble(dt * 3);
    }
    if (run.over) {
      gameOver();
      return;
    }
    if (ship.s >= segment.spline.length - 30) {
      finishSegment();
    }
    updateCamera(dt);
  },
  (_, ) => {
    environment.update(music, ship.object.position);
    features?.animate(music.beatPulse, elapsed, fenceOpenNow);
    trails.update(
      ship.object,
      ship.speed / ship.stats.maxSpeed,
      ship.dashing || music.dropActive,
    );
    const targetFov = 72 + music.energy * 8 + music.beatPulse * 2 + (music.dropActive ? 6 : 0) + juice.fovKick;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
    post.update(music.energy, music.beatPulse, music.dropActive);
    hud.update(run, ship.speed * 3.6, 1 / 60);
    audioDebug.update(music);
    nowPlaying.update();
    post.render();
  },
);

function openMenu(): void {
  showMenu(
    ui,
    save,
    async (kind) => {
      await pickAudio(kind);
      hud.setVisible(true);
      nowPlaying.startPolling();
      run = newRun();
      state = "run";
      startSegment();
    },
    () => showHangar(ui, save, openMenu),
  );
}

hud.setVisible(false);
void handleRedirect()
  .catch(() => {}) // failed token exchange → menu just shows disconnected
  .then(openMenu);
loop.start();

// dev/test hook (harmless in prod; lets automation poke game state)
Object.assign(window as unknown as Record<string, unknown>, {
  __game: {
    get state() { return state; },
    get run() { return run; },
    get ship() { return ship; },
    get features() { return features; },
    music,
  },
});
