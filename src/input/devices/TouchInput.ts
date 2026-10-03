import type { Action, ActionWriter, InputDevice, InputFrame } from '../InputActions';
import { InputTuning } from '../InputBindings';

type PointerRole = { kind: 'stick' } | { kind: 'camera'; lastX: number; lastY: number } | { kind: 'button'; action: Action; el: HTMLElement };

const ICONS: Record<string, string> = {
  attackLight: `<svg viewBox="0 0 64 64"><path d="M50 8 L56 14 L26 44 L20 38 Z" fill="currentColor"/><path d="M14 40 L24 50 M18 46 L10 54" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`,
  attackHeavy: `<svg viewBox="0 0 64 64"><path d="M46 6 L58 18 L24 52 L12 40 Z" fill="currentColor"/><path d="M10 44 L20 54 M14 50 L6 58" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="14" r="3" fill="#000" opacity=".35"/></svg>`,
  dodge: `<svg viewBox="0 0 64 64"><path d="M14 40 A18 18 0 1 1 40 50" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M8 32 L14 44 L26 38" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  interact: `<svg viewBox="0 0 64 64"><path d="M22 34 V16 a4 4 0 0 1 8 0 V30 V12 a4 4 0 0 1 8 0 V30 V16 a4 4 0 0 1 8 0 V36 C46 48 40 56 30 56 C22 56 18 50 14 42 L10 34 a4 4 0 0 1 7 -4 Z" fill="currentColor"/></svg>`,
  lockOn: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="5"/><path d="M32 4 V16 M32 48 V60 M4 32 H16 M48 32 H60" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="currentColor"/></svg>`,
  pause: `<svg viewBox="0 0 64 64"><rect x="16" y="12" width="11" height="40" rx="3" fill="currentColor"/><rect x="37" y="12" width="11" height="40" rx="3" fill="currentColor"/></svg>`,
};

/**
 * Touch controls: floating virtual joystick (left), camera drag / pinch zoom (right) and
 * on-screen action buttons. The DOM is created here; visibility is driven by the UI through
 * the `touch-active` class on the root element.
 */
export class TouchInput implements InputDevice {
  readonly kind = 'touch' as const;
  readonly root: HTMLElement;

  private readonly stickZone: HTMLElement;
  private readonly cameraZone: HTMLElement;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
  private readonly buttons = new Map<Action, HTMLElement>();
  private readonly pointers = new Map<number, PointerRole>();
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();

  private stickId = -1;
  private stickOriginX = 0;
  private stickOriginY = 0;
  private stickX = 0;
  private stickY = 0;
  private sprintTimer = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private zoom = 0;
  private pinchDist = 0;
  private activity = false;
  private readonly cleanup: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch-layer';
    this.root.innerHTML = `
      <div class="touch-zone touch-zone-stick"></div>
      <div class="touch-zone touch-zone-camera"></div>
      <div class="touch-stick"><div class="touch-stick-knob"></div></div>
      <div class="touch-stick-hint">Move</div>
      <div class="touch-buttons">
        <button class="tb tb-light" data-action="attackLight" aria-label="Light attack">${ICONS.attackLight}</button>
        <button class="tb tb-heavy" data-action="attackHeavy" aria-label="Heavy attack">${ICONS.attackHeavy}</button>
        <button class="tb tb-dodge" data-action="dodge" aria-label="Dodge">${ICONS.dodge}</button>
        <button class="tb tb-interact" data-action="interact" aria-label="Interact">${ICONS.interact}</button>
        <button class="tb tb-lock" data-action="lockOn" aria-label="Lock on">${ICONS.lockOn}</button>
      </div>
      <button class="tb tb-pause" data-action="pause" aria-label="Pause">${ICONS.pause}</button>
    `;
    container.appendChild(this.root);
    this.stickZone = this.root.querySelector('.touch-zone-stick')!;
    this.cameraZone = this.root.querySelector('.touch-zone-camera')!;
    this.stickBase = this.root.querySelector('.touch-stick')!;
    this.stickKnob = this.root.querySelector('.touch-stick-knob')!;
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      this.buttons.set(el.dataset.action as Action, el);
      this.listen(el, 'pointerdown', (e) => this.onButtonDown(e as PointerEvent, el));
    });
    this.listen(this.stickZone, 'pointerdown', (e) => this.onStickDown(e as PointerEvent));
    this.listen(this.cameraZone, 'pointerdown', (e) => this.onCameraDown(e as PointerEvent));
    this.listen(window, 'pointermove', (e) => this.onMove(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onUp(e as PointerEvent));
    this.listen(window, 'pointercancel', (e) => this.onUp(e as PointerEvent));
  }

  private listen(el: EventTarget, type: string, fn: (e: Event) => void): void {
    el.addEventListener(type, fn);
    this.cleanup.push(() => el.removeEventListener(type, fn));
  }

  private isTouch(e: PointerEvent): boolean {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  private onButtonDown(e: PointerEvent, el: HTMLElement): void {
    if (!this.isTouch(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const action = el.dataset.action as Action;
    this.pointers.set(e.pointerId, { kind: 'button', action, el });
    this.held.add(action);
    this.pressed.add(action);
    el.classList.add('pressed');
    this.activity = true;
  }

  private onStickDown(e: PointerEvent): void {
    if (!this.isTouch(e) || this.stickId !== -1) return;
    e.preventDefault();
    this.stickId = e.pointerId;
    this.pointers.set(e.pointerId, { kind: 'stick' });
    const r = InputTuning.touchStickRadius;
    this.stickOriginX = Math.max(r + 12, Math.min(window.innerWidth - r - 12, e.clientX));
    this.stickOriginY = Math.max(r + 12, Math.min(window.innerHeight - r - 12, e.clientY));
    this.stickBase.style.left = `${this.stickOriginX}px`;
    this.stickBase.style.top = `${this.stickOriginY}px`;
    this.stickBase.classList.add('active');
    this.updateStick(e.clientX, e.clientY);
    this.activity = true;
  }

  private onCameraDown(e: PointerEvent): void {
    if (!this.isTouch(e)) return;
    e.preventDefault();
    this.pointers.set(e.pointerId, { kind: 'camera', lastX: e.clientX, lastY: e.clientY });
    this.pinchDist = this.currentPinchDistance();
    this.activity = true;
  }

  private cameraPointers(): Array<{ lastX: number; lastY: number }> {
    const out: Array<{ lastX: number; lastY: number }> = [];
    for (const p of this.pointers.values()) if (p.kind === 'camera') out.push(p);
    return out;
  }

  private currentPinchDistance(): number {
    const cams = this.cameraPointers();
    if (cams.length < 2) return 0;
    return Math.hypot(cams[0].lastX - cams[1].lastX, cams[0].lastY - cams[1].lastY);
  }

  private onMove(e: PointerEvent): void {
    const role = this.pointers.get(e.pointerId);
    if (!role) return;
    if (role.kind === 'stick') {
      this.updateStick(e.clientX, e.clientY);
    } else if (role.kind === 'camera') {
      const dx = e.clientX - role.lastX;
      const dy = e.clientY - role.lastY;
      role.lastX = e.clientX;
      role.lastY = e.clientY;
      const cams = this.cameraPointers();
      if (cams.length >= 2) {
        const d = this.currentPinchDistance();
        if (this.pinchDist > 0) this.zoom -= (d - this.pinchDist) * InputTuning.touchPinchZoom * 0.1;
        this.pinchDist = d;
      } else {
        this.lookYaw += dx * InputTuning.touchYawSensitivity;
        this.lookPitch += dy * InputTuning.touchPitchSensitivity;
      }
    }
    this.activity = true;
  }

  private onUp(e: PointerEvent): void {
    const role = this.pointers.get(e.pointerId);
    if (!role) return;
    this.pointers.delete(e.pointerId);
    if (role.kind === 'stick') {
      this.stickId = -1;
      this.stickX = 0;
      this.stickY = 0;
      this.sprintTimer = 0;
      this.stickBase.classList.remove('active', 'sprinting');
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    } else if (role.kind === 'button') {
      role.el.classList.remove('pressed');
      // only release if no other pointer still holds the same button
      let still = false;
      for (const p of this.pointers.values()) if (p.kind === 'button' && p.action === role.action) still = true;
      if (!still) this.held.delete(role.action);
    } else {
      this.pinchDist = this.currentPinchDistance();
    }
  }

  private updateStick(cx: number, cy: number): void {
    const r = InputTuning.touchStickRadius;
    let dx = cx - this.stickOriginX;
    let dy = cy - this.stickOriginY;
    const d = Math.hypot(dx, dy);
    if (d > r) {
      dx = (dx / d) * r;
      dy = (dy / d) * r;
    }
    this.stickX = dx / r;
    this.stickY = -dy / r;
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  update(dt: number, frame: InputFrame, actions: ActionWriter): boolean {
    const mag = Math.hypot(this.stickX, this.stickY);
    if (mag > 0.08) {
      frame.moveX += this.stickX;
      frame.moveY += this.stickY;
    }
    if (mag >= InputTuning.touchSprintThreshold) this.sprintTimer += dt;
    else this.sprintTimer = 0;
    const sprinting = this.sprintTimer > 0.22;
    if (sprinting) frame.sprintHint = true;
    this.stickBase.classList.toggle('sprinting', sprinting);

    for (const a of this.held) actions.hold(a);
    for (const a of this.pressed) actions.press(a);
    frame.lookYaw += this.lookYaw;
    frame.lookPitch += this.lookPitch;
    frame.zoom += this.zoom;

    const active = this.activity || this.pointers.size > 0;
    this.activity = false;
    return active;
  }

  /** Highlights the interact button when something can be interacted with. */
  setInteractAvailable(available: boolean): void {
    this.buttons.get('interact')?.classList.toggle('available', available);
  }

  setLockActive(active: boolean): void {
    this.buttons.get('lockOn')?.classList.toggle('active', active);
  }

  endFrame(): void {
    this.pressed.clear();
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.zoom = 0;
  }

  reset(): void {
    this.pointers.clear();
    this.held.clear();
    this.pressed.clear();
    this.stickId = -1;
    this.stickX = 0;
    this.stickY = 0;
    this.stickBase.classList.remove('active', 'sprinting');
    this.buttons.forEach((b) => b.classList.remove('pressed'));
  }

  dispose(): void {
    for (const c of this.cleanup) c();
    this.root.remove();
  }
}
