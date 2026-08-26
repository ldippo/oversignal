import type { Run } from "../game/run";

export class Hud {
  private root: HTMLDivElement;
  private speedEl: HTMLDivElement;
  private hullFill: HTMLDivElement;
  private segEl: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private comboEl: HTMLDivElement;
  private banner: HTMLDivElement;
  private pipsEl: HTMLDivElement;
  private pipCount = -1;
  private pipMax = -1;
  private bannerTimer = 0;
  private syncEl: HTMLDivElement;
  private syncLabel: HTMLSpanElement;
  private syncBars: HTMLElement[];
  private lastSyncState = "";
  private tipEl: HTMLDivElement;
  private tipQueue: string[] = [];
  private tipTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.innerHTML = `
      <div class="hud-speed"></div>
      <div class="hud-hull"><div class="hud-hull-fill"></div></div>
      <div class="hud-pips"></div>
      <div class="hud-sync"><span class="sync-bars"><i></i><i></i><i></i></span><span class="sync-label"></span></div>
      <div class="hud-tip"></div>
      <div class="hud-seg"></div>
      <div class="hud-score"></div>
      <div class="hud-combo"></div>
      <div class="hud-banner"></div>
    `;
    parent.appendChild(this.root);
    this.speedEl = this.root.querySelector(".hud-speed")!;
    this.hullFill = this.root.querySelector(".hud-hull-fill")!;
    this.segEl = this.root.querySelector(".hud-seg")!;
    this.scoreEl = this.root.querySelector(".hud-score")!;
    this.comboEl = this.root.querySelector(".hud-combo")!;
    this.banner = this.root.querySelector(".hud-banner")!;
    this.pipsEl = this.root.querySelector(".hud-pips")!;
    this.syncEl = this.root.querySelector(".hud-sync")!;
    this.syncLabel = this.root.querySelector(".sync-label")!;
    this.syncBars = [...this.root.querySelectorAll<HTMLElement>(".sync-bars i")];
    this.tipEl = this.root.querySelector(".hud-tip")!;
  }

  /** Beat-sync chip: bar count from confidence, label states, beat pulse. */
  updateSync(confidence: number, silent: boolean, beatPulse: number): void {
    const label = silent ? "CLOCK" : confidence > 0.6 ? "LOCKED" : confidence > 0.25 ? "SYNCING" : "NO BEAT";
    if (label !== this.lastSyncState) {
      this.lastSyncState = label;
      this.syncLabel.textContent = label;
      const bars = silent ? 3 : confidence > 0.75 ? 3 : confidence > 0.5 ? 2 : confidence > 0.25 ? 1 : 0;
      this.syncBars.forEach((b, i) => b.classList.toggle("on", i < bars));
    }
    this.syncEl.classList.toggle("pulse", beatPulse > 0.55);
  }

  /** One-shot onboarding callout; queued so tips never overlap. */
  showTip(text: string): void {
    this.tipQueue.push(text);
  }

  update(run: Run, speedKmh: number, dt: number): void {
    this.speedEl.textContent = `${Math.round(speedKmh)}`;
    const pct = (run.hull / run.mods.hullMax) * 100;
    this.hullFill.style.transform = `scaleX(${pct / 100})`;
    this.hullFill.classList.toggle("low", pct < 30);
    const filled = Math.floor(run.dashPips + 1e-6);
    if (filled !== this.pipCount || run.mods.maxPips !== this.pipMax) {
      this.pipCount = filled;
      this.pipMax = run.mods.maxPips;
      this.pipsEl.innerHTML = Array.from({ length: this.pipMax }, (_, i) =>
        `<span class="dash-pip${i < filled ? " filled" : ""}"></span>`).join("");
    }
    this.segEl.textContent = `SECTOR ${run.segmentIndex + 1}`;
    this.scoreEl.textContent = `${Math.floor(run.score)}`.padStart(7, "0");
    this.comboEl.textContent = run.combo > 1 ? `×${run.combo}` : "";
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove("show");
    }
    if (this.tipTimer > 0) {
      this.tipTimer -= dt;
      if (this.tipTimer <= 0) this.tipEl.classList.remove("show");
    } else if (this.tipQueue.length > 0) {
      this.tipEl.textContent = this.tipQueue.shift()!;
      this.tipEl.classList.add("show");
      this.tipTimer = 4;
    }
  }

  flashBanner(text: string, seconds = 2): void {
    this.banner.textContent = text;
    this.banner.classList.add("show");
    this.bannerTimer = seconds;
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? "" : "none";
  }
}
