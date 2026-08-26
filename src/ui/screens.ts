import type { AudioSourceKind } from "../audio/capture";
import type { SaveData } from "../core/save";
import type { Upgrade } from "../game/upgrades";
import { beginAuth, disconnect, getClientId, isConnected, setClientId } from "../audio/spotify";

export function showMenu(
  parent: HTMLElement,
  save: SaveData,
  onStart: (kind: AudioSourceKind) => Promise<void>,
  onHangar: () => void,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h1>FZERO</h1>
    <p>Anti-gravity roguelite racer that runs on your music.<br/>
    Put Spotify (or anything) in another tab, then sync it here.</p>
    <div class="stat">SCRAP ${save.scrap} · BEST ${save.bestScore} · RUNS ${save.totalRuns}</div>
    <button class="secondary hangar-btn">HANGAR · SHIP: ${save.selectedShip.toUpperCase()}</button>
    <button data-src="tab">SYNC TAB AUDIO</button>
    <button data-src="mic" class="secondary">USE MICROPHONE</button>
    <button data-src="silent" class="secondary">RUN SILENT (120 BPM)</button>
    <p class="hint" style="font-size:13px;opacity:.6">Tab sync: pick the tab playing music and tick “Also share tab audio”.</p>
    <div class="spotify-box">
      <button class="secondary sp-main"></button>
      <div class="sp-setup" style="display:none">
        <p style="font-size:13px;opacity:.75;max-width:460px">
          Optional now-playing HUD (track + album art). Create an app at
          developer.spotify.com/dashboard, add redirect URI
          <code>${window.location.origin}/</code>, then paste its Client ID:
        </p>
        <div class="sp-row">
          <input class="sp-id" placeholder="Spotify Client ID" spellcheck="false" />
          <button class="sp-save">CONNECT</button>
        </div>
      </div>
    </div>
    <p class="err" style="color:#ff6a6a;min-height:1.2em"></p>
  `;
  parent.appendChild(el);
  const err = el.querySelector<HTMLParagraphElement>(".err")!;

  // tab-audio capture doesn't exist on mobile browsers
  if (!navigator.mediaDevices?.getDisplayMedia) {
    el.querySelector<HTMLButtonElement>('button[data-src="tab"]')!.style.display = "none";
    el.querySelector<HTMLParagraphElement>(".hint")!.textContent =
      "On mobile: use the microphone near your speaker, or run silent.";
  }

  el.querySelector<HTMLButtonElement>(".hangar-btn")!.addEventListener("click", () => {
    el.remove();
    onHangar();
  });

  // Spotify now-playing (optional, cosmetic)
  const spMain = el.querySelector<HTMLButtonElement>(".sp-main")!;
  const spSetup = el.querySelector<HTMLDivElement>(".sp-setup")!;
  const spId = el.querySelector<HTMLInputElement>(".sp-id")!;
  const refreshSpotify = () => {
    spMain.textContent = isConnected() ? "SPOTIFY ✓ CONNECTED — CLICK TO DISCONNECT" : "CONNECT SPOTIFY (NOW-PLAYING HUD)";
  };
  refreshSpotify();
  spMain.addEventListener("click", () => {
    err.textContent = "";
    if (isConnected()) {
      disconnect();
      refreshSpotify();
    } else if (getClientId()) {
      void beginAuth().catch((e) => { err.textContent = String(e); });
    } else {
      spSetup.style.display = spSetup.style.display === "none" ? "" : "none";
    }
  });
  el.querySelector<HTMLButtonElement>(".sp-save")!.addEventListener("click", () => {
    if (!spId.value.trim()) return;
    setClientId(spId.value);
    void beginAuth().catch((e) => { err.textContent = String(e); });
  });

  el.querySelectorAll<HTMLButtonElement>("button[data-src]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      err.textContent = "";
      btn.disabled = true;
      try {
        await onStart(btn.dataset.src as AudioSourceKind);
        el.remove();
      } catch (e) {
        err.textContent = e instanceof Error ? e.message : String(e);
        btn.disabled = false;
      }
    });
  });
  return el;
}

export function showUpgradeDraft(
  parent: HTMLElement,
  sectorCleared: number,
  upgrades: Upgrade[],
  onPick: (u: Upgrade) => void,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "screen";
  el.innerHTML = `
    <h2>SECTOR ${sectorCleared} CLEAR</h2>
    <p>Choose an upgrade</p>
    <div class="cards"></div>
  `;
  const cards = el.querySelector(".cards")!;
  upgrades.forEach((u, i) => {
    const card = document.createElement("button");
    card.className = "card";
    card.innerHTML = `<span class="card-key">${i + 1}</span><span class="card-name">${u.name}</span><span class="card-desc">${u.desc}</span>`;
    card.addEventListener("click", () => {
      el.remove();
      window.removeEventListener("keydown", onKey);
      onPick(u);
    });
    cards.appendChild(card);
  });
  const onKey = (e: KeyboardEvent) => {
    const idx = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
    if (idx >= 0 && idx < upgrades.length) {
      el.remove();
      window.removeEventListener("keydown", onKey);
      onPick(upgrades[idx]);
    }
  };
  window.addEventListener("keydown", onKey);
  parent.appendChild(el);
  return el;
}
