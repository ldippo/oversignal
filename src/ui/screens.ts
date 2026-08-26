import type { AudioSourceKind } from "../audio/capture";
import type { SaveData } from "../core/save";
import type { Upgrade } from "../game/upgrades";
import { beginAuth, disconnect, getClientId, isConnected, setClientId } from "../audio/spotify";
import { playedToday, shareText, todayUTC } from "../game/daily";

export function showMenu(
  parent: HTMLElement,
  save: SaveData,
  onStart: (kind: AudioSourceKind | "keep") => Promise<void>,
  onHangar: () => void,
  hasAudio = false,
  onDaily?: () => void,
): HTMLDivElement {
  const dailyDone = playedToday(save);
  const hasTab = !!navigator.mediaDevices?.getDisplayMedia;
  const primarySrc = hasAudio ? "keep" : hasTab ? "tab" : "mic";
  const primaryLabel = hasAudio ? "START RUN" : hasTab ? "SYNC YOUR MUSIC" : "SYNC WITH MIC";
  const hint = hasAudio
    ? "music still synced"
    : hasTab
      ? "share the tab that’s playing — tick “also share tab audio”"
      : "hold your phone near the speaker";
  const alts: string[] = [];
  if (hasAudio && hasTab) alts.push('<button class="alt" data-src="tab">sync a new tab</button>');
  if (hasAudio || hasTab) alts.push('<button class="alt" data-src="mic">use microphone</button>');
  alts.push('<button class="alt" data-src="silent">play without music</button>');
  const el = document.createElement("div");
  el.className = "title-screen";
  el.innerHTML = `
    <div class="title-block">
      <h1 class="wordmark">OVERSIGNAL</h1>
      <p class="tagline">RUNS ON YOUR MUSIC</p>
    </div>
    <div class="title-actions">
      <button class="sync-btn" data-src="${primarySrc}">
        <span>${primaryLabel}</span>
      </button>
      <p class="sync-hint">${hint}</p>
      <div class="alt-actions">
        ${alts.join('<span class="dot">·</span>')}
      </div>
      <button class="daily-btn">
        <span>${dailyDone ? `DAILY ✓ ${save.daily!.score.toLocaleString()} — SHARE` : `DAILY RUN · ${todayUTC()}`}</span>
      </button>
      <p class="daily-hint">${dailyDone
        ? "same track for everyone — next run at 00:00 UTC"
        : "one attempt · stock ship · same track for everyone"}</p>
      <p class="err" role="alert"></p>
    </div>
    <div class="title-footer">
      <span class="foot-stat">◆ ${save.scrap} SCRAP</span>
      <span class="foot-stat">BEST ${save.bestScore.toLocaleString()}</span>
      <span class="foot-spacer"></span>
      <button class="foot-link hangar-btn">HANGAR — ${save.selectedShip.toUpperCase()}</button>
      <button class="foot-link sp-main"></button>
    </div>
    <div class="sp-setup" hidden>
      <p>Optional now-playing card. Create an app at
        <strong>developer.spotify.com/dashboard</strong>, add redirect URI
        <code>${window.location.origin}/</code>, paste its Client ID:</p>
      <div class="sp-row">
        <input class="sp-id" placeholder="Spotify Client ID" spellcheck="false" />
        <button class="sp-save">CONNECT</button>
      </div>
      <button class="sp-close">close</button>
    </div>
  `;
  parent.appendChild(el);
  const err = el.querySelector<HTMLParagraphElement>(".err")!;

  el.querySelector<HTMLButtonElement>(".hangar-btn")!.addEventListener("click", () => {
    el.remove();
    onHangar();
  });

  const dailyBtn = el.querySelector<HTMLButtonElement>(".daily-btn")!;
  dailyBtn.addEventListener("click", () => {
    if (dailyDone) {
      if (save.daily) void navigator.clipboard.writeText(shareText(save.daily)).catch(() => {});
      dailyBtn.querySelector("span")!.textContent = "COPIED ✓";
    } else if (onDaily) {
      el.remove();
      onDaily();
    }
  });

  // Spotify now-playing (optional, cosmetic) — panel only appears on demand
  const spMain = el.querySelector<HTMLButtonElement>(".sp-main")!;
  const spSetup = el.querySelector<HTMLDivElement>(".sp-setup")!;
  const spId = el.querySelector<HTMLInputElement>(".sp-id")!;
  const refreshSpotify = () => {
    spMain.textContent = isConnected() ? "SPOTIFY ✓" : "SPOTIFY";
    spMain.title = isConnected() ? "Connected — click to disconnect" : "Connect for the now-playing card";
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
      spSetup.hidden = !spSetup.hidden;
    }
  });
  el.querySelector<HTMLButtonElement>(".sp-save")!.addEventListener("click", () => {
    if (!spId.value.trim()) return;
    setClientId(spId.value);
    void beginAuth().catch((e) => { err.textContent = String(e); });
  });
  el.querySelector<HTMLButtonElement>(".sp-close")!.addEventListener("click", () => {
    spSetup.hidden = true;
  });

  el.querySelectorAll<HTMLButtonElement>("button[data-src]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      err.textContent = "";
      btn.disabled = true;
      try {
        await onStart(btn.dataset.src as AudioSourceKind | "keep");
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
  el.className = "draft-screen";
  el.innerHTML = `
    <div class="draft-block">
      <h2 class="draft-title">SECTOR ${sectorCleared} CLEAR</h2>
      <p class="draft-sub">CHOOSE UPGRADE</p>
    </div>
    <div class="draft-cards"></div>
  `;
  const cards = el.querySelector(".draft-cards")!;
  upgrades.forEach((u, i) => {
    const card = document.createElement("button");
    card.className = "draft-card";
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
