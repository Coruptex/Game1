/**
 * Every gameplay action the game understands. Gameplay code only ever talks to these actions,
 * never to concrete keys / buttons, so new devices or rebinding never touch gameplay code.
 */
export const ACTIONS = [
  'attackLight',
  'attackHeavy',
  'dodge',
  'sprint',
  'lockOn',
  'interact',
  'pause',
  'walkToggle',
  'cameraLeft',
  'cameraRight',
  'confirm',
  'back',
] as const;

export type Action = (typeof ACTIONS)[number];

export type DeviceKind = 'keyboardMouse' | 'gamepad' | 'touch';

export type GamepadStyle = 'xbox' | 'playstation' | 'generic';

/** Per-frame analog contributions written by devices. */
export interface InputFrame {
  /** Movement intent: x = right, y = forward. Devices add to it; the manager clamps to length 1. */
  moveX: number;
  moveY: number;
  /** Camera yaw delta (radians) for this frame. Positive rotates the camera to the right. */
  lookYaw: number;
  /** Camera pitch delta (radians) for this frame. */
  lookPitch: number;
  /** Zoom delta (positive = zoom out). */
  zoom: number;
  /** Device requests sprinting through an analog gesture (e.g. joystick pushed to the edge). */
  sprintHint: boolean;
}

/** Interface the manager hands to devices so they can report digital action state. */
export interface ActionWriter {
  hold(action: Action): void;
  press(action: Action): void;
}

export interface InputDevice {
  readonly kind: DeviceKind;
  /**
   * Polls the device and writes its contributions.
   * @returns true when the device received meaningful user input this frame.
   */
  update(dt: number, frame: InputFrame, actions: ActionWriter): boolean;
  /** Called at the end of each frame to clear per-frame edge state. */
  endFrame(): void;
  /** Forget held state (window blur, menus opening). */
  reset(): void;
  dispose(): void;
}
