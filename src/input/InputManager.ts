import * as THREE from 'three';
import { ACTIONS, type Action, type ActionWriter, type DeviceKind, type GamepadStyle, type InputDevice, type InputFrame } from './InputActions';
import { KeyboardMouseInput } from './devices/KeyboardMouseInput';
import { GamepadInput } from './devices/GamepadInput';
import { TouchInput } from './devices/TouchInput';

type DeviceListener = (kind: DeviceKind, style: GamepadStyle) => void;

/**
 * Merges all input devices into one set of gameplay actions + analog axes.
 * Gameplay code reads `move`, `look`, `isHeld()` and `wasPressed()` only.
 */
export class InputManager {
  readonly keyboardMouse: KeyboardMouseInput;
  readonly gamepad: GamepadInput;
  readonly touch: TouchInput;
  private readonly devices: InputDevice[];

  /** Movement intent, x = right, y = forward, length <= 1. */
  readonly move = new THREE.Vector2();
  lookYaw = 0;
  lookPitch = 0;
  zoom = 0;

  activeDevice: DeviceKind = 'keyboardMouse';
  /** When false, gameplay queries return neutral values (menus, cutscenes). */
  gameplayEnabled = true;

  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();
  private readonly prevHeld = new Set<Action>();
  private readonly consumed = new Set<Action>();
  private readonly frame: InputFrame = { moveX: 0, moveY: 0, lookYaw: 0, lookPitch: 0, zoom: 0, sprintHint: false };
  private readonly listeners = new Set<DeviceListener>();
  private readonly writer: ActionWriter = {
    hold: (a) => this.held.add(a),
    press: (a) => this.pressed.add(a),
  };
  private lastStyle: GamepadStyle = 'xbox';
  private readonly injected: Action[] = [];

  constructor(root: HTMLElement) {
    this.keyboardMouse = new KeyboardMouseInput(root);
    this.gamepad = new GamepadInput();
    this.touch = new TouchInput(root);
    this.devices = [this.keyboardMouse, this.gamepad, this.touch];
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) {
      this.activeDevice = 'touch';
    }
  }

  get gamepadStyle(): GamepadStyle {
    return this.gamepad.style;
  }

  onDeviceChanged(fn: DeviceListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  update(dt: number): void {
    const f = this.frame;
    f.moveX = 0;
    f.moveY = 0;
    f.lookYaw = 0;
    f.lookPitch = 0;
    f.zoom = 0;
    f.sprintHint = false;
    this.prevHeld.clear();
    for (const a of this.held) this.prevHeld.add(a);
    this.held.clear();
    this.pressed.clear();

    let newActive: DeviceKind | null = null;
    for (const d of this.devices) {
      const active = d.update(dt, f, this.writer);
      if (active && newActive === null) newActive = d.kind;
    }
    if (f.sprintHint) this.held.add('sprint');
    for (const a of this.injected) {
      this.pressed.add(a);
      this.held.add(a);
    }
    this.injected.length = 0;

    const len = Math.hypot(f.moveX, f.moveY);
    this.move.set(f.moveX, f.moveY);
    if (len > 1) this.move.divideScalar(len);
    this.lookYaw = f.lookYaw;
    this.lookPitch = f.lookPitch;
    this.zoom = f.zoom;

    // Consumption only lasts while the action stays held.
    for (const a of Array.from(this.consumed)) if (!this.held.has(a) && !this.pressed.has(a)) this.consumed.delete(a);

    const style = this.gamepad.style;
    if ((newActive && newActive !== this.activeDevice) || (this.activeDevice === 'gamepad' && style !== this.lastStyle)) {
      if (newActive) this.activeDevice = newActive;
      this.lastStyle = style;
      for (const l of this.listeners) l(this.activeDevice, style);
    }
  }

  endFrame(): void {
    for (const d of this.devices) d.endFrame();
  }

  /** Action is currently held (on any device). */
  isHeld(action: Action): boolean {
    return this.held.has(action) && !this.consumed.has(action);
  }

  /** Action was pressed this frame (and not yet consumed by another system). */
  wasPressed(action: Action): boolean {
    return this.pressed.has(action) && !this.consumed.has(action);
  }

  wasReleased(action: Action): boolean {
    return this.prevHeld.has(action) && !this.held.has(action);
  }

  /** Marks an action as handled so other systems ignore it until it is released. */
  consume(action: Action): void {
    this.consumed.add(action);
  }

  /** Clears held state on every device (e.g. when opening menus). */
  reset(): void {
    for (const d of this.devices) d.reset();
    this.held.clear();
    this.pressed.clear();
    this.move.set(0, 0);
  }

  /** Lets tests and scripted sequences inject a press (applied on the next update). */
  injectPress(action: Action): void {
    this.injected.push(action);
  }

  static readonly actions = ACTIONS;

  dispose(): void {
    for (const d of this.devices) d.dispose();
  }
}
