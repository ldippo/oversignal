import { persistSave, type SaveData } from "../core/save";
import type { MusicState } from "../audio/music-state";

export interface PauseOptions {
  title: string;
  resumeLabel: string;
  onClose: () => void;
  onQuit?: () => void; // quit to title (pause only)
}

/**
 * Pause overlay + settings panel (same component: title screen opens it as
 * "SETTINGS"). Mutates save.settings, persists on every change, and calls
 * applySettings so changes are live immediately.
 */
export function showPause(
  parent: HTMLElement,
  save: SaveData,
  music: MusicState,
  applySettings: () => void,
  opts: PauseOptions,
): HTMLDivElement {
  const s = save.settings;
  const el = document.createElement("div");
  el.className = "pause-screen";
  el.innerHTML = `
    <div class="pause-block">
      <h2 class="pause-title">${opts.title}</h2>
    </div>
    <div class="settings-rows">
      <div class="setting-row">
        <span class="setting-name">SFX VOLUME</span>
        <input class="setting-slider vol" type="range" min="0" max="1" step="0.05" value="${s.sfxVolume}" />
        <span class="setting-val vol-val">${Math.round(s.sfxVolume * 100)}%</span>
      </div>
      <div class="setting-row">
        <span class="setting-name">SCREEN SHAKE</span>
        <span></span>
        <button class="setting-toggle shake">${s.screenShake ? "ON" : "OFF"}</button>
      </div>
      <div class="setting-row">
        <span class="setting-name">FLASHES</span>
        <span class="setting-note">strobes &amp; damage flashes</span>
        <button class="setting-toggle flashes">${s.flashes ? "ON" : "OFF"}</button>
      </div>
      <div class="setting-row">
        <span class="setting-name">SYNC OFFSET <span class="beat-dot"></span></span>
        <input class="setting-slider lat" type="range" min="-200" max="200" step="5" value="${s.latencyMs}" />
        <span class="setting-val lat-val">${s.latencyMs}ms</span>
      </div>
      <div class="setting-row">
        <span class="setting-name">CALIBRATE</span>
        <span class="setting-note cal-status">tap the button on the beat ×8</span>
        <button class="setting-toggle cal-btn">TAP</button>
      </div>
    </div>
    <button class="retry-btn resume-btn"><span>${opts.resumeLabel}</span></button>
    ${opts.onQuit ? '<button class="alt quit-btn">quit to title</button>' : ""}
  `;
  parent.appendChild(el);

  const commit = (): void => {
    persistSave(save);
    applySettings();
  };

  const vol = el.querySelector<HTMLInputElement>(".vol")!;
  const volVal = el.querySelector<HTMLSpanElement>(".vol-val")!;
  vol.addEventListener("input", () => {
    s.sfxVolume = parseFloat(vol.value);
    volVal.textContent = `${Math.round(s.sfxVolume * 100)}%`;
    commit();
  });

  const shakeBtn = el.querySelector<HTMLButtonElement>(".shake")!;
  shakeBtn.addEventListener("click", () => {
    s.screenShake = !s.screenShake;
    shakeBtn.textContent = s.screenShake ? "ON" : "OFF";
    commit();
  });

  const flashBtn = el.querySelector<HTMLButtonElement>(".flashes")!;
  flashBtn.addEventListener("click", () => {
    s.flashes = !s.flashes;
    flashBtn.textContent = s.flashes ? "ON" : "OFF";
    commit();
  });

  const lat = el.querySelector<HTMLInputElement>(".lat")!;
  const latVal = el.querySelector<HTMLSpanElement>(".lat-val")!;
  const setLatency = (ms: number): void => {
    s.latencyMs = Math.max(-200, Math.min(200, Math.round(ms)));
    lat.value = String(s.latencyMs);
    latVal.textContent = `${s.latencyMs}ms`;
    commit();
  };
  lat.addEventListener("input", () => setLatency(parseFloat(lat.value)));

  // tap calibration: median signed error vs the (already offset) grid
  const calBtn = el.querySelector<HTMLButtonElement>(".cal-btn")!;
  const calStatus = el.querySelector<HTMLSpanElement>(".cal-status")!;
  let taps: number[] = [];
  calBtn.addEventListener("click", () => {
    const p = music.phase();
    const interval = 60 / music.bpm;
    taps.push((p > 0.5 ? p - 1 : p) * interval);
    calStatus.textContent = `${taps.length}/8`;
    if (taps.length >= 8) {
      taps.sort((a, b) => a - b);
      const median = taps[4];
      setLatency(s.latencyMs - median * 1000);
      calStatus.textContent = `offset set — ${s.latencyMs}ms`;
      taps = [];
    }
  });

  // beat dot pulses on the offset grid so the slider can be eyeballed
  const dot = el.querySelector<HTMLSpanElement>(".beat-dot")!;
  const tick = (): void => {
    if (!el.isConnected) return;
    dot.classList.toggle("on", music.phase() < 0.18);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  el.querySelector<HTMLButtonElement>(".resume-btn")!.addEventListener("click", () => {
    el.remove();
    opts.onClose();
  });
  el.querySelector<HTMLButtonElement>(".quit-btn")?.addEventListener("click", () => {
    el.remove();
    opts.onQuit?.();
  });
  return el;
}
