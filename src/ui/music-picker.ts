import { trending, search, type AudiusTrack } from "../audio/audius";

export interface PickerCallbacks {
  onFiles: (files: File[]) => void;
  onAudius: (track: AudiusTrack) => void;
  onClose: () => void;
}

function fmtDur(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/** Music browser: local files (full library mode) + Audius trending/search. */
export function showMusicPicker(parent: HTMLElement, cb: PickerCallbacks): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "picker-screen";
  el.innerHTML = `
    <div class="picker-head">
      <h2 class="picker-title">PICK YOUR MUSIC</h2>
      <p class="picker-sub">EXACT BEAT SYNC — ANALYZED BEFORE YOU LAUNCH</p>
    </div>
    <div class="picker-body">
      <button class="file-zone">
        <span class="fz-big">ADD AUDIO FILES</span>
        <span class="fz-small">mp3 · wav · m4a · ogg — or drop them anywhere</span>
      </button>
      <div class="audius-box">
        <div class="audius-head">
          <span class="audius-label">AUDIUS</span>
          <input class="audius-search" placeholder="search tracks…" spellcheck="false" />
        </div>
        <div class="audius-status">loading trending…</div>
        <div class="audius-list"></div>
      </div>
    </div>
    <button class="alt picker-close">back to title</button>
    <input type="file" accept="audio/*" multiple hidden />
  `;
  parent.appendChild(el);

  const fileInput = el.querySelector<HTMLInputElement>('input[type="file"]')!;
  el.querySelector<HTMLButtonElement>(".file-zone")!.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) cb.onFiles([...fileInput.files]);
  });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("audio/"));
    if (files.length) cb.onFiles(files);
  });

  const status = el.querySelector<HTMLDivElement>(".audius-status")!;
  const list = el.querySelector<HTMLDivElement>(".audius-list")!;

  const renderTracks = (tracks: AudiusTrack[]): void => {
    status.textContent = tracks.length ? "" : "nothing found";
    list.innerHTML = "";
    for (const t of tracks) {
      const row = document.createElement("button");
      row.className = "audius-row";
      row.innerHTML = `
        ${t.artUrl ? `<img src="${t.artUrl}" alt="" loading="lazy" />` : '<span class="art-blank"></span>'}
        <span class="ar-text"><span class="ar-title"></span><span class="ar-artist"></span></span>
        <span class="ar-dur">${fmtDur(t.duration)}</span>
      `;
      row.querySelector(".ar-title")!.textContent = t.title;
      row.querySelector(".ar-artist")!.textContent = t.artist;
      row.addEventListener("click", () => cb.onAudius(t));
      list.appendChild(row);
    }
  };

  const loadTrending = (): void => {
    status.textContent = "loading trending…";
    trending()
      .then(renderTracks)
      .catch(() => { status.textContent = "audius unreachable — files still work"; });
  };
  loadTrending();

  const searchInput = el.querySelector<HTMLInputElement>(".audius-search")!;
  let searchTimer = 0;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    searchTimer = window.setTimeout(() => {
      if (!q) { loadTrending(); return; }
      status.textContent = "searching…";
      search(q)
        .then(renderTracks)
        .catch(() => { status.textContent = "search failed"; });
    }, 350);
  });

  el.querySelector<HTMLButtonElement>(".picker-close")!.addEventListener("click", () => {
    el.remove();
    cb.onClose();
  });
  return el;
}

/** Blocking progress overlay for download/analysis. */
export function showLoading(parent: HTMLElement, text: string): { update: (t: string) => void; close: () => void } {
  const el = document.createElement("div");
  el.className = "loading-screen";
  el.innerHTML = `<div class="loading-box"><span class="loading-spin"></span><span class="loading-text"></span></div>`;
  el.querySelector(".loading-text")!.textContent = text;
  parent.appendChild(el);
  return {
    update: (t: string) => { el.querySelector(".loading-text")!.textContent = t; },
    close: () => el.remove(),
  };
}
