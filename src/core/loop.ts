export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number) => void;

const STEP = 1 / 120;
const MAX_FRAME = 0.1;

export class GameLoop {
  private last = 0;
  private acc = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private update: UpdateFn,
    private render: RenderFn,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      let frame = (now - this.last) / 1000;
      if (frame > MAX_FRAME) frame = MAX_FRAME;
      this.last = now;
      this.acc += frame;
      while (this.acc >= STEP) {
        this.update(STEP);
        this.acc -= STEP;
      }
      this.render(this.acc / STEP);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
