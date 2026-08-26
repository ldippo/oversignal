export interface InputState {
  steer: number; // -1..1 (left..right)
  accel: boolean;
  brake: boolean;
  dash: boolean; // edge-triggered: true only on the frame the button was pressed
}

const keys = new Set<string>();
let dashQueued = false;
let padDashHeld = false;

let attached = false;

export function attachInput(): void {
  if (attached) return;
  attached = true;
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && !keys.has("Space")) dashQueued = true;
    keys.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
}

function pollGamepad(state: InputState): void {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = pads.find((p) => p && p.connected);
  if (!pad) return;
  const x = pad.axes[0] ?? 0;
  if (Math.abs(x) > 0.15) state.steer += x;
  if (pad.buttons[7]?.pressed || pad.buttons[0]?.pressed) state.accel = true; // RT / A
  if (pad.buttons[6]?.pressed || pad.buttons[1]?.pressed) state.brake = true; // LT / B
  const dashHeld = !!(pad.buttons[2]?.pressed || pad.buttons[5]?.pressed); // X / RB
  if (dashHeld && !padDashHeld) state.dash = true;
  padDashHeld = dashHeld;
}

export function readInput(): InputState {
  const state: InputState = {
    steer: 0,
    accel: keys.has("KeyW") || keys.has("ArrowUp"),
    brake: keys.has("KeyS") || keys.has("ArrowDown"),
    dash: dashQueued,
  };
  dashQueued = false;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) state.steer -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) state.steer += 1;
  pollGamepad(state);
  state.steer = Math.max(-1, Math.min(1, state.steer));
  return state;
}
