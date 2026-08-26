/**
 * Mobile touch controls: hold left/right half to steer, DASH/BRAKE buttons,
 * auto-accelerate while active. Merged into readInput() via getTouchState().
 */

export interface TouchState {
  active: boolean; // touch device + controls mounted
  steer: number;
  brake: boolean;
  dashQueued: boolean;
}

const state: TouchState = { active: false, steer: 0, brake: false, dashQueued: false };

export function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function getTouchState(): TouchState {
  return state;
}

/** Consume the dash edge trigger (called once per input read). */
export function consumeTouchDash(): boolean {
  const d = state.dashQueued;
  state.dashQueued = false;
  return d;
}

export class TouchControls {
  private root: HTMLDivElement;
  private steerTouches = new Map<number, number>(); // touch id -> -1 | 1

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "touch-controls";
    this.root.innerHTML = `
      <div class="steer-zone steer-left"><span>◀</span></div>
      <div class="steer-zone steer-right"><span>▶</span></div>
      <button class="touch-btn touch-brake">BRAKE</button>
      <button class="touch-btn touch-dash">DASH</button>
    `;
    parent.appendChild(this.root);
    state.active = true;

    const zoneL = this.root.querySelector<HTMLDivElement>(".steer-left")!;
    const zoneR = this.root.querySelector<HTMLDivElement>(".steer-right")!;
    const brake = this.root.querySelector<HTMLButtonElement>(".touch-brake")!;
    const dash = this.root.querySelector<HTMLButtonElement>(".touch-dash")!;

    const bindZone = (zone: HTMLDivElement, dir: number): void => {
      zone.addEventListener("touchstart", (e) => {
        e.preventDefault();
        for (const t of Array.from(e.changedTouches)) this.steerTouches.set(t.identifier, dir);
        this.recompute();
        zone.classList.add("held");
      }, { passive: false });
      const release = (e: TouchEvent): void => {
        for (const t of Array.from(e.changedTouches)) this.steerTouches.delete(t.identifier);
        this.recompute();
        if (![...this.steerTouches.values()].includes(dir)) zone.classList.remove("held");
      };
      zone.addEventListener("touchend", release);
      zone.addEventListener("touchcancel", release);
    };
    bindZone(zoneL, -1);
    bindZone(zoneR, 1);

    brake.addEventListener("touchstart", (e) => { e.preventDefault(); state.brake = true; }, { passive: false });
    brake.addEventListener("touchend", () => { state.brake = false; });
    brake.addEventListener("touchcancel", () => { state.brake = false; });
    dash.addEventListener("touchstart", (e) => { e.preventDefault(); state.dashQueued = true; }, { passive: false });
  }

  private recompute(): void {
    let steer = 0;
    for (const dir of this.steerTouches.values()) steer += dir;
    state.steer = Math.max(-1, Math.min(1, steer));
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? "" : "none";
    if (!v) {
      this.steerTouches.clear();
      state.steer = 0;
      state.brake = false;
    }
  }
}
