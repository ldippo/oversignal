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

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.innerHTML = `
      <div class="hud-speed"></div>
      <div class="hud-hull"><div class="hud-hull-fill"></div></div>
      <div class="hud-pips"></div>
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
