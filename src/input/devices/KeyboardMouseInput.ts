import type { Action, ActionWriter, InputDevice, InputFrame } from '../InputActions';
import { InputTuning, KeyboardBindings, MOUSE_CAMERA_BUTTON, MouseBindings, MoveKeys } from '../InputBindings';

/** Keyboard + mouse device. Listens to DOM events and converts them into actions every frame. */
export class KeyboardMouseInput implements InputDevice {
  readonly kind = 'keyboardMouse' as const;

  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mousePressed = new Set<number>();
  private wheel = 0;
  private dragYaw = 0;
  private dragPitch = 0;
  private activity = false;
  private walk = false;
  private middleDownAt = 0;
  private middleTravel = 0;
  private middleClick = false;
  private readonly boundCodes: Set<string>;
  private readonly cleanup: Array<() => void> = [];

  constructor(target: HTMLElement) {
    this.boundCodes = new Set<string>([
      ...Object.values(MoveKeys).flat(),
      ...Object.values(KeyboardBindings).flat(),
    ]);
    this.listen(window, 'keydown', (e) => this.onKeyDown(e as KeyboardEvent));
    this.listen(window, 'keyup', (e) => this.onKeyUp(e as KeyboardEvent));
    this.listen(window, 'blur', () => this.reset());
    this.listen(target, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(target, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.listen(target, 'contextmenu', (e) => e.preventDefault());
    // Prevent middle-click autoscroll.
    this.listen(target, 'mousedown', (e) => {
      if ((e as MouseEvent).button === 1) e.preventDefault();
    });
  }

  private listen(el: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    el.addEventListener(type, fn, opts);
    this.cleanup.push(() => el.removeEventListener(type, fn, opts));
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (this.boundCodes.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keysDown.add(e.code);
    this.keysPressed.add(e.code);
    this.activity = true;
    if (KeyboardBindings.walkToggle?.includes(e.code)) this.walk = !this.walk;
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    this.mouseDown.add(e.button);
    this.mousePressed.add(e.button);
    this.activity = true;
    if (e.button === MOUSE_CAMERA_BUTTON) {
      this.middleDownAt = performance.now();
      this.middleTravel = 0;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    if (e.button === MOUSE_CAMERA_BUTTON && this.mouseDown.has(MOUSE_CAMERA_BUTTON)) {
      const dt = performance.now() - this.middleDownAt;
      if (dt <= InputTuning.middleClickMaxMs && this.middleTravel <= InputTuning.middleClickMaxTravel) {
        this.middleClick = true;
      }
    }
    this.mouseDown.delete(e.button);
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    if (this.mouseDown.has(MOUSE_CAMERA_BUTTON)) {
      this.dragYaw += e.movementX * InputTuning.mouseYawSensitivity;
      this.dragPitch += e.movementY * InputTuning.mousePitchSensitivity;
      this.middleTravel += Math.abs(e.movementX) + Math.abs(e.movementY);
      this.activity = true;
    } else if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) {
      // Deliberate mouse movement switches prompts back to keyboard & mouse.
      this.activity = true;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const lines = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    this.wheel += lines * InputTuning.wheelZoom;
    this.activity = true;
  }

  private anyDown(codes: readonly string[] | undefined): boolean {
    if (!codes) return false;
    for (const c of codes) if (this.keysDown.has(c)) return true;
    return false;
  }

  private anyPressed(codes: readonly string[] | undefined): boolean {
    if (!codes) return false;
    for (const c of codes) if (this.keysPressed.has(c)) return true;
    return false;
  }

  update(dt: number, frame: InputFrame, actions: ActionWriter): boolean {
    let mx = 0;
    let my = 0;
    if (this.anyDown(MoveKeys.forward)) my += 1;
    if (this.anyDown(MoveKeys.back)) my -= 1;
    if (this.anyDown(MoveKeys.right)) mx += 1;
    if (this.anyDown(MoveKeys.left)) mx -= 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const scale = (this.walk ? InputTuning.walkFraction : 1) / len;
      frame.moveX += mx * scale;
      frame.moveY += my * scale;
    }

    for (const [action, codes] of Object.entries(KeyboardBindings) as [Action, string[]][]) {
      if (this.anyDown(codes)) actions.hold(action);
      if (this.anyPressed(codes)) actions.press(action);
    }
    for (const [action, buttons] of Object.entries(MouseBindings) as [Action, number[]][]) {
      for (const b of buttons) {
        if (this.mouseDown.has(b)) actions.hold(action);
        if (this.mousePressed.has(b)) actions.press(action);
      }
    }
    if (this.middleClick) actions.press('lockOn');

    if (this.anyDown(KeyboardBindings.cameraLeft)) frame.lookYaw -= InputTuning.keyYawSpeed * dt;
    if (this.anyDown(KeyboardBindings.cameraRight)) frame.lookYaw += InputTuning.keyYawSpeed * dt;
    frame.lookYaw += this.dragYaw;
    frame.lookPitch += this.dragPitch;
    frame.zoom += this.wheel;

    const active = this.activity || this.keysDown.size > 0;
    this.activity = false;
    return active;
  }

  endFrame(): void {
    this.keysPressed.clear();
    this.mousePressed.clear();
    this.wheel = 0;
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.middleClick = false;
  }

  reset(): void {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.mouseDown.clear();
    this.mousePressed.clear();
    this.wheel = 0;
    this.dragYaw = 0;
    this.dragPitch = 0;
  }

  get isWalking(): boolean {
    return this.walk;
  }

  dispose(): void {
    for (const c of this.cleanup) c();
    this.cleanup.length = 0;
  }
}
