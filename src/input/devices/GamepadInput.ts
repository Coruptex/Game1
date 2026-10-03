import type { Action, ActionWriter, GamepadStyle, InputDevice, InputFrame } from '../InputActions';
import { GamepadBindings, InputTuning } from '../InputBindings';

const L3 = 10;

/** Applies a radial deadzone and rescales so movement starts smoothly at the deadzone edge. */
export function radialDeadzone(x: number, y: number, deadzone: number): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag < deadzone) return [0, 0];
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return [(x / mag) * scaled, (y / mag) * scaled];
}

export function detectGamepadStyle(id: string): GamepadStyle {
  const s = id.toLowerCase();
  if (/(054c|sony|playstation|dualsense|dualshock|ps4|ps5)/.test(s)) return 'playstation';
  if (/(045e|xbox|xinput|microsoft)/.test(s)) return 'xbox';
  return 'generic';
}

/** Standard-mapping gamepad (Xbox, PlayStation, generic XInput) via the Gamepad API. */
export class GamepadInput implements InputDevice {
  readonly kind = 'gamepad' as const;
  style: GamepadStyle = 'xbox';
  connected = false;

  private prevButtons: boolean[] = [];
  private sprintToggled = false;
  private activePad: Gamepad | null = null;
  private padIndex = -1;
  private blocked = false;
  private readonly onConnect = (e: GamepadEvent) => {
    this.padIndex = e.gamepad.index;
    this.style = detectGamepadStyle(e.gamepad.id);
    this.connected = true;
  };
  private readonly onDisconnect = (e: GamepadEvent) => {
    if (e.gamepad.index === this.padIndex) {
      this.padIndex = -1;
      this.connected = false;
      this.prevButtons = [];
    }
  };

  constructor() {
    window.addEventListener('gamepadconnected', this.onConnect);
    window.addEventListener('gamepaddisconnected', this.onDisconnect);
  }

  private poll(): Gamepad | null {
    if (this.blocked || !navigator.getGamepads) return null;
    let pads: (Gamepad | null)[];
    try {
      pads = navigator.getGamepads();
    } catch {
      // embedded pages can be denied the Gamepad API by permissions policy (throws SecurityError)
      this.blocked = true;
      return null;
    }
    if (this.padIndex >= 0 && pads[this.padIndex]) return pads[this.padIndex];
    for (const p of pads) {
      if (p && p.connected) {
        this.padIndex = p.index;
        this.style = detectGamepadStyle(p.id);
        this.connected = true;
        return p;
      }
    }
    return null;
  }

  update(dt: number, frame: InputFrame, actions: ActionWriter): boolean {
    const pad = this.poll();
    this.activePad = pad;
    if (!pad) return false;
    let active = false;

    const pressedNow: boolean[] = pad.buttons.map((b) => b.pressed || b.value > InputTuning.triggerThreshold);
    const edge = (i: number) => !!pressedNow[i] && !this.prevButtons[i];

    for (const [action, buttons] of Object.entries(GamepadBindings) as [Action, number[]][]) {
      if (action === 'sprint') continue;
      for (const b of buttons) {
        if (pressedNow[b]) {
          actions.hold(action);
          active = true;
        }
        if (edge(b)) actions.press(action);
      }
    }

    // Left stick: movement (stick up = forward).
    const [lx, ly] = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, InputTuning.stickDeadzone);
    const moveMag = Math.hypot(lx, ly);
    if (moveMag > 0) {
      frame.moveX += lx;
      frame.moveY += -ly;
      active = true;
    }

    // L3 toggles sprint; releasing the stick ends the sprint.
    if (edge(L3)) this.sprintToggled = !this.sprintToggled;
    if (moveMag < 0.25) this.sprintToggled = false;
    if (this.sprintToggled) actions.hold('sprint');

    // Right stick: camera.
    const [rx, ry] = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, InputTuning.stickDeadzone);
    if (rx !== 0 || ry !== 0) {
      frame.lookYaw += rx * Math.abs(rx) * InputTuning.stickYawSpeed * dt;
      frame.lookPitch += ry * Math.abs(ry) * InputTuning.stickPitchSpeed * dt;
      active = true;
    }

    // D-pad up/down zooms.
    if (pressedNow[12]) frame.zoom -= 1.2 * dt;
    if (pressedNow[13]) frame.zoom += 1.2 * dt;

    this.prevButtons = pressedNow;
    return active;
  }

  /** Haptic feedback (silently ignored when unsupported). */
  rumble(strong: number, weak: number, durationMs: number): void {
    const pad = this.activePad as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null;
    const act = pad?.vibrationActuator;
    if (!act?.playEffect) return;
    try {
      act
        .playEffect('dual-rumble', { duration: durationMs, strongMagnitude: strong, weakMagnitude: weak })
        .catch(() => undefined);
    } catch {
      /* not allowed here */
    }
  }

  endFrame(): void {
    /* edges are derived from prevButtons */
  }

  reset(): void {
    this.sprintToggled = false;
  }

  dispose(): void {
    window.removeEventListener('gamepadconnected', this.onConnect);
    window.removeEventListener('gamepaddisconnected', this.onDisconnect);
  }
}
