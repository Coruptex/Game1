import type { Action } from './InputActions';

/**
 * CENTRAL INPUT CONFIGURATION
 * ---------------------------------------------------------------------------
 * Change bindings and sensitivities here. Keyboard entries use KeyboardEvent.code values,
 * mouse entries use MouseEvent.button indices, gamepad entries use the W3C "standard"
 * gamepad mapping button indices:
 *
 *   0 A/Cross  1 B/Circle  2 X/Square  3 Y/Triangle  4 LB/L1  5 RB/R1  6 LT/L2  7 RT/R2
 *   8 Back/Share  9 Start/Options  10 L3  11 R3  12-15 D-pad (up, down, left, right)
 */

export const MoveKeys = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export const KeyboardBindings: Partial<Record<Action, string[]>> = {
  sprint: ['ShiftLeft', 'ShiftRight'],
  dodge: ['Space'],
  lockOn: ['Tab'],
  interact: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  walkToggle: ['KeyC'],
  cameraLeft: ['KeyQ'],
  cameraRight: ['KeyE'],
  confirm: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  attackLight: ['KeyJ'],
  attackHeavy: ['KeyK'],
};

export const MouseBindings: Partial<Record<Action, number[]>> = {
  attackLight: [0],
  attackHeavy: [2],
};

/** Middle mouse: drag rotates the camera, a short click toggles lock-on. */
export const MOUSE_CAMERA_BUTTON = 1;

export const GamepadBindings: Partial<Record<Action, number[]>> = {
  dodge: [0],
  interact: [1],
  attackLight: [2, 5],
  attackHeavy: [3, 7],
  lockOn: [11, 4],
  sprint: [10],
  pause: [9],
  confirm: [0],
  back: [1],
};

export const InputTuning = {
  /** Radians of camera yaw per pixel of middle-mouse drag. */
  mouseYawSensitivity: 0.0065,
  mousePitchSensitivity: 0.004,
  /** Q/E camera rotation speed (rad/s). */
  keyYawSpeed: 2.3,
  /** Right stick camera rotation speed (rad/s at full deflection). */
  stickYawSpeed: 3.0,
  stickPitchSpeed: 1.4,
  stickDeadzone: 0.17,
  triggerThreshold: 0.35,
  /** Zoom delta per wheel "line". */
  wheelZoom: 0.0016,
  touchYawSensitivity: 0.009,
  touchPitchSensitivity: 0.005,
  touchPinchZoom: 0.012,
  /** Joystick radius in CSS pixels. */
  touchStickRadius: 62,
  /** Joystick deflection above which the player sprints (after a short hold). */
  touchSprintThreshold: 0.97,
  /** Keyboard walk speed fraction when walk is toggled. */
  walkFraction: 0.42,
  /** Max click duration (ms) / travel (px) for a middle-click to count as lock-on. */
  middleClickMaxMs: 280,
  middleClickMaxTravel: 7,
};
