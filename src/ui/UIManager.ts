import * as THREE from 'three';
import type { InputManager } from '../input/InputManager';
import type { DeviceKind, GamepadStyle } from '../input/InputActions';
import { ACTION_LABELS, glyph, type PromptAction } from './Glyphs';
import type { HealthComponent } from '../combat/HealthComponent';
import type { StaminaComponent } from '../combat/StaminaComponent';
import type { QualityLevel } from '../render/Quality';

export type BannerKind = 'death' | 'victory' | 'ember' | 'treasure';

export interface PauseCallbacks {
  onResume(): void;
  onToggleSound(): boolean;
  onQuality(level: QualityLevel): void;
  onRestart(): void;
  isMuted(): boolean;
  quality(): QualityLevel;
}

interface WorldBarTarget {
  id: number;
  name: string;
  position: THREE.Vector3;
  height: number;
  health: HealthComponent;
  visible: boolean;
}

const HINT_ACTIONS: PromptAction[] = ['move', 'camera', 'attackLight', 'attackHeavy', 'dodge', 'sprint', 'lockOn', 'interact', 'pause'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

/**
 * DOM overlay UI. Minimal, Soulslike: bars bottom-left, prompts bottom-centre, big banners in the
 * middle. Re-renders button glyphs whenever the active input device changes.
 */
export class UIManager {
  readonly root: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpTrail: HTMLElement;
  private readonly stFill: HTMLElement;
  private readonly stBar: HTMLElement;
  private readonly hpBar: HTMLElement;
  private readonly gold: HTMLElement;
  private readonly goldValue: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly bannerEl: HTMLElement;
  private readonly regionEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly fadeEl: HTMLElement;
  private readonly reticle: HTMLElement;
  private readonly barsLayer: HTMLElement;
  private readonly hints: HTMLElement;
  private readonly title: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly enemyBars = new Map<number, { root: HTMLElement; fill: HTMLElement; trail: HTMLElement }>();
  private device: DeviceKind = 'keyboardMouse';
  private style: GamepadStyle = 'xbox';
  private promptData: { verb: string; label: string } | null = null;
  private bannerTimer = 0;
  private regionTimer = 0;
  private toastTimer = 0;
  private hintTimer = 75;
  private goldShown = 0;
  private goldTarget = 0;
  private readonly v = new THREE.Vector3();
  private pauseOpen = false;
  private pauseIndex = 0;
  private navCooldown = 0;
  private pauseCb: PauseCallbacks | null = null;
  private titleCb: (() => void) | null = null;
  private titleReady = false;
  private controlsOpen = false;

  constructor(
    container: HTMLElement,
    private readonly input: InputManager,
  ) {
    this.root = el('div', 'ui-root', container);

    // --- HUD -----------------------------------------------------------------
    this.hud = el('div', 'hud hidden', this.root);
    const bars = el('div', 'hud-bars', this.hud);
    this.hpBar = el('div', 'bar bar-hp', bars);
    this.hpTrail = el('div', 'bar-trail', this.hpBar);
    this.hpFill = el('div', 'bar-fill', this.hpBar);
    this.stBar = el('div', 'bar bar-st', bars);
    this.stFill = el('div', 'bar-fill', this.stBar);
    this.gold = el('div', 'hud-gold', this.hud);
    el('span', 'coin', this.gold);
    this.goldValue = el('span', 'gold-value', this.gold, '0');

    this.barsLayer = el('div', 'world-bars', this.root);
    this.reticle = el('div', 'lock-reticle hidden', this.root, '<span></span>');
    this.prompt = el('div', 'prompt hidden', this.root);
    this.toastEl = el('div', 'toast hidden', this.root);
    this.regionEl = el('div', 'region hidden', this.root);
    this.bannerEl = el('div', 'banner hidden', this.root);
    this.hints = el('div', 'hints hidden', this.root);
    this.fadeEl = el('div', 'fade', this.root);

    // --- title -----------------------------------------------------------------
    this.title = el(
      'div',
      'title-screen',
      this.root,
      `<div class="title-inner">
        <div class="title-ember"></div>
        <h1>Ember <span>of</span> Retribution</h1>
        <div class="title-sub">A pirate's tale of ash and salt</div>
        <div class="title-loading"><div class="title-loading-fill"></div></div>
        <div class="title-status">Preparing the voyage…</div>
        <div class="title-press hidden"></div>
      </div>
      <div class="title-foot">Prototype build — all art & sound generated procedurally</div>`,
    );

    // --- pause / controls -----------------------------------------------------------
    this.pause = el('div', 'pause hidden', this.root);
    this.controls = el('div', 'controls-panel hidden', this.root);

    this.input.onDeviceChanged((d, s) => this.setDevice(d, s));
    this.setDevice(this.input.activeDevice, this.input.gamepadStyle);
    this.title.addEventListener('pointerdown', () => this.tryStartFromTitle());
  }

  // -------------------------------------------------------------------------
  // Title & loading
  // -------------------------------------------------------------------------

  setLoading(fraction: number, label: string): void {
    const fill = this.title.querySelector<HTMLElement>('.title-loading-fill');
    if (fill) fill.style.width = `${Math.round(fraction * 100)}%`;
    const status = this.title.querySelector<HTMLElement>('.title-status');
    if (status) status.textContent = label;
  }

  showTitlePrompt(onStart: () => void, hasSave: boolean): void {
    this.titleCb = onStart;
    this.titleReady = true;
    this.title.classList.add('ready');
    const status = this.title.querySelector<HTMLElement>('.title-status');
    if (status) status.textContent = hasSave ? 'Your journey continues' : 'A new journey begins';
    this.renderTitlePress();
  }

  private renderTitlePress(): void {
    const press = this.title.querySelector<HTMLElement>('.title-press');
    if (!press) return;
    press.classList.remove('hidden');
    const what = this.device === 'touch' ? 'Tap to begin' : this.device === 'gamepad' ? `Press ${glyph('dodge', 'gamepad', this.style)} to begin` : 'Press any key to begin';
    press.innerHTML = what;
  }

  private tryStartFromTitle(): void {
    if (!this.titleReady || !this.titleCb) return;
    const cb = this.titleCb;
    this.titleCb = null;
    this.titleReady = false;
    this.title.classList.add('leaving');
    setTimeout(() => this.title.classList.add('hidden'), 900);
    cb();
  }

  get titleVisible(): boolean {
    return !this.title.classList.contains('hidden') && !this.title.classList.contains('leaving');
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  setHUDVisible(v: boolean): void {
    this.hud.classList.toggle('hidden', !v);
    if (v && this.hintTimer > 0) this.hints.classList.remove('hidden');
  }

  updateBars(hp: HealthComponent, st: StaminaComponent): void {
    // Bar length scales with max values (Soulslike), capped for small screens via CSS max-width.
    this.hpBar.style.setProperty('--len', `${hp.max * 3.2}px`);
    this.stBar.style.setProperty('--len', `${st.max * 2.6}px`);
    this.hpFill.style.transform = `scaleX(${Math.max(0, hp.current / hp.max)})`;
    this.hpTrail.style.transform = `scaleX(${Math.max(0, hp.trail / hp.max)})`;
    this.stFill.style.transform = `scaleX(${Math.max(0, st.current / st.max)})`;
    this.stBar.classList.toggle('exhausted', st.exhausted);
    this.hpBar.classList.toggle('low', hp.current / hp.max < 0.25);
  }

  flashStamina(): void {
    this.stBar.classList.remove('flash');
    void this.stBar.offsetWidth;
    this.stBar.classList.add('flash');
  }

  setGold(value: number, instant = false): void {
    this.goldTarget = value;
    if (instant) this.goldShown = value;
    this.gold.classList.remove('pulse');
    void this.gold.offsetWidth;
    if (!instant) this.gold.classList.add('pulse');
  }

  // -------------------------------------------------------------------------
  // Prompts & messages
  // -------------------------------------------------------------------------

  setPrompt(p: { verb: string; label: string } | null): void {
    this.promptData = p;
    this.renderPrompt();
  }

  private renderPrompt(): void {
    const p = this.promptData;
    if (!p) {
      this.prompt.classList.add('hidden');
      return;
    }
    this.prompt.innerHTML = `${glyph('interact', this.device, this.style)}<span class="prompt-verb">${p.verb}</span><span class="prompt-label">${p.label}</span>`;
    this.prompt.classList.remove('hidden');
  }

  banner(text: string, kind: BannerKind, duration = 3.2): void {
    this.bannerEl.className = `banner banner-${kind}`;
    this.bannerEl.innerHTML = `<div class="banner-band"></div><div class="banner-text">${text}</div>`;
    this.bannerTimer = duration;
  }

  regionBanner(name: string, subtitle?: string): void {
    this.regionEl.innerHTML = `<div class="region-line"></div><div class="region-name">${name}</div>${subtitle ? `<div class="region-sub">${subtitle}</div>` : ''}<div class="region-line"></div>`;
    this.regionEl.classList.remove('hidden', 'out');
    this.regionTimer = 4.2;
  }

  toast(text: string, duration = 3.2): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden', 'out');
    this.toastTimer = duration;
  }

  private fadeValue = 0;
  private fadeTarget = 0;
  private fadeSpeed = 1;

  /** Full-screen fade (0 = clear, 1 = black), advanced by update() so it follows the game loop. */
  fadeTo(alpha: number, seconds: number): void {
    this.fadeTarget = alpha;
    this.fadeSpeed = seconds <= 0 ? 1e6 : Math.abs(alpha - this.fadeValue) / seconds;
  }

  get fadeLevel(): number {
    return this.fadeValue;
  }

  // -------------------------------------------------------------------------
  // World-space UI (enemy bars, lock reticle)
  // -------------------------------------------------------------------------

  private project(p: THREE.Vector3, camera: THREE.Camera, w: number, h: number): { x: number; y: number; ok: boolean } {
    this.v.copy(p).project(camera);
    const ok = this.v.z > -1 && this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2;
    return { x: (this.v.x * 0.5 + 0.5) * w, y: (-this.v.y * 0.5 + 0.5) * h, ok };
  }

  updateWorldUI(targets: WorldBarTarget[], lockPoint: THREE.Vector3 | null, camera: THREE.Camera): void {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const seen = new Set<number>();
    for (const t of targets) {
      if (!t.visible) continue;
      seen.add(t.id);
      let bar = this.enemyBars.get(t.id);
      if (!bar) {
        const root = el('div', 'enemy-bar', this.barsLayer);
        const trail = el('div', 'enemy-bar-trail', root);
        const fill = el('div', 'enemy-bar-fill', root);
        bar = { root, fill, trail };
        this.enemyBars.set(t.id, bar);
      }
      this.v.copy(t.position);
      this.v.y += t.height + 0.45;
      const s = this.project(this.v, camera, w, h);
      bar.root.style.display = s.ok ? 'block' : 'none';
      bar.root.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      bar.fill.style.transform = `scaleX(${t.health.current / t.health.max})`;
      bar.trail.style.transform = `scaleX(${t.health.trail / t.health.max})`;
    }
    for (const [id, bar] of this.enemyBars) {
      if (!seen.has(id)) {
        bar.root.remove();
        this.enemyBars.delete(id);
      }
    }
    if (lockPoint) {
      const s = this.project(lockPoint, camera, w, h);
      this.reticle.classList.toggle('hidden', !s.ok);
      this.reticle.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    } else {
      this.reticle.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------------------
  // Devices & hints
  // -------------------------------------------------------------------------

  setDevice(device: DeviceKind, style: GamepadStyle): void {
    const changed = device !== this.device || style !== this.style;
    this.device = device;
    this.style = style;
    this.root.parentElement?.classList.toggle('touch-active', device === 'touch');
    this.root.dataset.device = device;
    this.renderPrompt();
    this.renderHints();
    if (this.pauseOpen) this.renderPause();
    if (this.controlsOpen) this.renderControls();
    if (this.titleReady) this.renderTitlePress();
    if (changed && !this.hud.classList.contains('hidden')) {
      this.hintTimer = Math.max(this.hintTimer, 12);
      this.hints.classList.remove('hidden');
    }
  }

  private renderHints(): void {
    if (this.device === 'touch') {
      this.hints.innerHTML = '';
      return;
    }
    this.hints.innerHTML = HINT_ACTIONS.map((a) => `<div class="hint"><span class="hint-glyph">${glyph(a, this.device, this.style)}</span><span class="hint-label">${ACTION_LABELS[a]}</span></div>`).join('');
  }

  // -------------------------------------------------------------------------
  // Pause menu
  // -------------------------------------------------------------------------

  openPause(cb: PauseCallbacks): void {
    this.pauseCb = cb;
    this.pauseOpen = true;
    this.pauseIndex = 0;
    this.renderPause();
    this.pause.classList.remove('hidden');
  }

  closePause(): void {
    this.pauseOpen = false;
    this.controlsOpen = false;
    this.pause.classList.add('hidden');
    this.controls.classList.add('hidden');
  }

  get isPauseOpen(): boolean {
    return this.pauseOpen;
  }

  private pauseItems(): Array<{ label: string; action: () => void }> {
    const cb = this.pauseCb!;
    const q = cb.quality();
    const next: Record<QualityLevel, QualityLevel> = { high: 'medium', medium: 'low', low: 'high' };
    return [
      { label: 'Resume', action: () => cb.onResume() },
      { label: 'Controls', action: () => this.openControls() },
      {
        label: `Sound: ${cb.isMuted() ? 'Off' : 'On'}`,
        action: () => {
          cb.onToggleSound();
          this.renderPause();
        },
      },
      {
        label: `Graphics: ${q[0].toUpperCase()}${q.slice(1)}`,
        action: () => {
          cb.onQuality(next[q]);
          this.renderPause();
        },
      },
      { label: 'Restart Journey', action: () => this.confirmRestart() },
    ];
  }

  private confirmRestart(): void {
    const cb = this.pauseCb!;
    this.pause.innerHTML = `<div class="pause-inner"><h2>Restart Journey?</h2><p class="pause-note">All gold, opened chests and kindled shrines will be lost.</p>
      <div class="pause-items"><button class="pause-item" data-i="0">Restart</button><button class="pause-item" data-i="1">Cancel</button></div></div>`;
    const items = this.pause.querySelectorAll<HTMLButtonElement>('.pause-item');
    items[0].addEventListener('click', () => cb.onRestart());
    items[1].addEventListener('click', () => this.renderPause());
    this.pauseIndex = 1;
    this.highlightPause(items);
    this.customItems = [() => cb.onRestart(), () => this.renderPause()];
  }

  private customItems: Array<() => void> | null = null;

  private renderPause(): void {
    if (!this.pauseCb) return;
    this.customItems = null;
    const items = this.pauseItems();
    this.pause.innerHTML = `<div class="pause-inner"><h2>Paused</h2><div class="pause-items">${items
      .map((it, i) => `<button class="pause-item" data-i="${i}">${it.label}</button>`)
      .join('')}</div><div class="pause-help">${this.menuHelp()}</div></div>`;
    const btns = this.pause.querySelectorAll<HTMLButtonElement>('.pause-item');
    btns.forEach((b, i) =>
      b.addEventListener('click', () => {
        this.pauseIndex = i;
        items[i].action();
      }),
    );
    this.pauseIndex = Math.min(this.pauseIndex, items.length - 1);
    this.highlightPause(btns);
  }

  private menuHelp(): string {
    if (this.device === 'gamepad') return `${glyph('dodge', 'gamepad', this.style)} Select &nbsp; ${glyph('interact', 'gamepad', this.style)} Back`;
    if (this.device === 'touch') return 'Tap to select';
    return `<span class="glyph key">↑</span><span class="glyph key">↓</span> Navigate &nbsp; <span class="glyph key wide">Enter</span> Select &nbsp; <span class="glyph key wide">Esc</span> Back`;
  }

  private highlightPause(btns: NodeListOf<HTMLButtonElement>): void {
    btns.forEach((b, i) => b.classList.toggle('selected', i === this.pauseIndex));
  }

  private openControls(): void {
    this.controlsOpen = true;
    this.renderControls();
    this.controls.classList.remove('hidden');
    this.pause.classList.add('hidden');
  }

  private closeControls(): void {
    this.controlsOpen = false;
    this.controls.classList.add('hidden');
    this.pause.classList.remove('hidden');
  }

  private renderControls(): void {
    const actions: PromptAction[] = ['move', 'camera', 'zoom', 'sprint', 'walk', 'dodge', 'attackLight', 'attackHeavy', 'lockOn', 'interact', 'pause'];
    const deviceName = this.device === 'gamepad' ? (this.style === 'playstation' ? 'PlayStation controller' : 'Controller') : this.device === 'touch' ? 'Touch' : 'Keyboard & mouse';
    this.controls.innerHTML = `<div class="controls-inner"><h2>Controls</h2><div class="controls-device">${deviceName}</div>
      <div class="controls-list">${actions
        .map((a) => `<div class="controls-row"><span class="controls-label">${ACTION_LABELS[a]}</span><span class="controls-glyph">${glyph(a, this.device, this.style)}</span></div>`)
        .join('')}</div>
      <p class="controls-note">The game switches prompts automatically when you use a different device.</p>
      <button class="pause-item selected controls-back">Back</button></div>`;
    this.controls.querySelector('.controls-back')?.addEventListener('click', () => this.closeControls());
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  update(dt: number): void {
    if (this.fadeValue !== this.fadeTarget) {
      const step = this.fadeSpeed * dt;
      const d = this.fadeTarget - this.fadeValue;
      this.fadeValue = Math.abs(d) <= step ? this.fadeTarget : this.fadeValue + Math.sign(d) * step;
      this.fadeEl.style.opacity = this.fadeValue.toFixed(3);
    }
    // title: any key / button
    if (this.titleReady && (this.input.wasPressed('confirm') || this.input.wasPressed('dodge') || this.input.wasPressed('attackLight') || this.input.wasPressed('pause') || this.input.wasPressed('interact'))) {
      this.tryStartFromTitle();
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      this.bannerEl.classList.toggle('show', this.bannerTimer > 0.6);
      if (this.bannerTimer <= 0) this.bannerEl.classList.add('hidden');
    }
    if (this.regionTimer > 0) {
      this.regionTimer -= dt;
      if (this.regionTimer < 0.9) this.regionEl.classList.add('out');
      if (this.regionTimer <= 0) this.regionEl.classList.add('hidden');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer < 0.5) this.toastEl.classList.add('out');
      if (this.toastTimer <= 0) this.toastEl.classList.add('hidden');
    }
    if (this.hintTimer > 0 && !this.hud.classList.contains('hidden')) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hints.classList.add('hidden');
    }
    if (this.goldShown !== this.goldTarget) {
      const d = this.goldTarget - this.goldShown;
      const step = Math.max(1, Math.abs(d) * dt * 4);
      this.goldShown = Math.abs(d) <= step ? this.goldTarget : this.goldShown + Math.sign(d) * step;
      this.goldValue.textContent = String(Math.round(this.goldShown));
    }

    if (this.pauseOpen) this.updateMenuNavigation(dt);
  }

  private updateMenuNavigation(dt: number): void {
    const inp = this.input;
    if (this.controlsOpen) {
      if (inp.wasPressed('back') || inp.wasPressed('confirm') || inp.wasPressed('interact')) this.closeControls();
      return;
    }
    const btns = this.pause.querySelectorAll<HTMLButtonElement>('.pause-item');
    if (btns.length === 0) return;
    this.navCooldown -= dt;
    const y = inp.move.y;
    if (Math.abs(y) < 0.3) this.navCooldown = 0;
    if (Math.abs(y) > 0.5 && this.navCooldown <= 0) {
      this.pauseIndex = (this.pauseIndex + (y < 0 ? 1 : -1) + btns.length) % btns.length;
      this.navCooldown = 0.22;
      this.highlightPause(btns);
    }
    if (inp.wasPressed('confirm')) {
      if (this.customItems) this.customItems[this.pauseIndex]?.();
      else this.pauseItems()[this.pauseIndex]?.action();
    } else if (inp.wasPressed('back') && !inp.wasPressed('pause')) {
      if (this.customItems) this.renderPause();
      else this.pauseCb?.onResume();
    }
  }
}
