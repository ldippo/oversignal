import { fetchNowPlaying, isConnected, type NowPlaying } from "../audio/spotify";

const POLL_MS = 5000;

/** Bottom-center track card: album art, title/artist, progress line. */
export class NowPlayingHud {
  private root: HTMLDivElement;
  private art: HTMLImageElement;
  private title: HTMLDivElement;
  private artist: HTMLDivElement;
  private bar: HTMLDivElement;
  private current: NowPlaying | null = null;
  private timer: number | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "now-playing";
    this.root.innerHTML = `
      <img class="np-art" alt="" style="display:none" />
      <div class="np-text">
        <div class="np-title"></div>
        <div class="np-artist"></div>
      </div>
      <div class="np-bar"><div class="np-bar-fill"></div></div>
    `;
    this.root.style.display = "none";
    parent.appendChild(this.root);
    this.art = this.root.querySelector(".np-art")!;
    this.title = this.root.querySelector(".np-title")!;
    this.artist = this.root.querySelector(".np-artist")!;
    this.bar = this.root.querySelector(".np-bar-fill")!;
  }

  startPolling(): void {
    if (this.timer !== null || !isConnected()) return;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        this.apply(await fetchNowPlaying());
      }
    };
    void poll();
    this.timer = window.setInterval(poll, POLL_MS);
  }

  stopPolling(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.root.style.display = "none";
  }

  private apply(np: NowPlaying | null): void {
    this.current = np;
    if (!np) {
      this.root.style.display = "none";
      return;
    }
    this.root.style.display = "";
    this.title.textContent = np.title;
    this.artist.textContent = np.artists;
    if (np.artUrl && this.art.src !== np.artUrl) this.art.src = np.artUrl;
    this.art.style.display = np.artUrl ? "" : "none";
  }

  /** Interpolate progress between polls. Call every render frame. */
  update(): void {
    const np = this.current;
    if (!np || np.durationMs <= 0) return;
    const progress = np.isPlaying ? np.progressMs + (Date.now() - np.fetchedAt) : np.progressMs;
    this.bar.style.transform = `scaleX(${Math.min(1, progress / np.durationMs)})`;
  }
}
