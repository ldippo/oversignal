import type { MusicState } from "../audio/music-state";

/** F3-toggled overlay: flux graph, band meters, bpm/energy readout. */
export class AudioDebug {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fluxHist: number[] = [];
  private visible = false;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 360;
    this.canvas.height = 140;
    this.canvas.style.cssText =
      "position:absolute;left:36px;bottom:70px;background:rgba(4,8,20,.75);border:1px solid rgba(78,243,255,.3);border-radius:4px;display:none;";
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
    window.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.visible = !this.visible;
        this.canvas.style.display = this.visible ? "" : "none";
      }
    });
  }

  update(music: MusicState): void {
    if (!this.visible) return;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    this.fluxHist.push(music.debugFlux);
    if (this.fluxHist.length > w) this.fluxHist.shift();

    ctx.clearRect(0, 0, w, h);

    // flux trace
    ctx.strokeStyle = "#4ef3ff";
    ctx.beginPath();
    for (let i = 0; i < this.fluxHist.length; i++) {
      const y = h - 20 - this.fluxHist[i] * (h - 40) * 4;
      if (i === 0) ctx.moveTo(i, y);
      else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // beat flash
    if (music.beatPulse > 0.5) {
      ctx.fillStyle = `rgba(255,62,200,${music.beatPulse * 0.8})`;
      ctx.fillRect(0, 0, w, 4);
    }

    // band meters
    const bands: Array<[string, number, string]> = [
      ["bass", music.bass, "#ff3ec8"],
      ["mid", music.mid, "#ffc44e"],
      ["high", music.high, "#4ef3ff"],
      ["energy", music.energy, "#8aff6a"],
    ];
    bands.forEach(([label, v, color], i) => {
      const x = 8 + i * 60;
      ctx.fillStyle = "rgba(255,255,255,.15)";
      ctx.fillRect(x, h - 16, 40, 8);
      ctx.fillStyle = color;
      ctx.fillRect(x, h - 16, 40 * Math.min(1, v), 8);
      ctx.fillStyle = "rgba(232,246,255,.7)";
      ctx.font = "10px monospace";
      ctx.fillText(label, x, h - 20);
    });

    ctx.fillStyle = "#e8f6ff";
    ctx.font = "12px monospace";
    ctx.fillText(
      `${music.bpm.toFixed(1)} bpm  conf ${(music.beatConfidence * 100) | 0}%  ${music.dropActive ? "DROP!" : ""}  ${music.sourceLabel}`,
      8,
      14,
    );
  }
}
