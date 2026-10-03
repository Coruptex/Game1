import type { DeviceKind, GamepadStyle } from '../input/InputActions';

/**
 * Button prompts for every action on every device. Returns small HTML snippets styled in CSS
 * (keycaps, mouse icons, coloured face buttons, stick icons).
 */
export type PromptAction =
  | 'move'
  | 'camera'
  | 'zoom'
  | 'sprint'
  | 'walk'
  | 'dodge'
  | 'attackLight'
  | 'attackHeavy'
  | 'lockOn'
  | 'interact'
  | 'pause';

const key = (k: string, wide = false) => `<span class="glyph key${wide ? ' wide' : ''}">${k}</span>`;
const mouse = (b: 'L' | 'R' | 'M' | 'W') =>
  `<span class="glyph mouse mouse-${b}"><svg viewBox="0 0 20 28"><rect x="1.5" y="1.5" width="17" height="25" rx="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 2 V11 M2 11 H18" stroke="currentColor" stroke-width="1.6"/>${
    b === 'L' ? '<path d="M2.5 10 V7 A7.5 7.5 0 0 1 9 2.6 V10 Z" fill="currentColor"/>' : ''
  }${b === 'R' ? '<path d="M17.5 10 V7 A7.5 7.5 0 0 0 11 2.6 V10 Z" fill="currentColor"/>' : ''}${
    b === 'M' || b === 'W' ? '<rect x="8.2" y="4" width="3.6" height="5.5" rx="1.8" fill="currentColor"/>' : ''
  }</svg></span>`;

const XBOX: Record<string, { label: string; cls: string }> = {
  A: { label: 'A', cls: 'xa' },
  B: { label: 'B', cls: 'xb' },
  X: { label: 'X', cls: 'xx' },
  Y: { label: 'Y', cls: 'xy' },
};
const PS: Record<string, { label: string; cls: string }> = {
  A: { label: '✕', cls: 'pa' },
  B: { label: '○', cls: 'pb' },
  X: { label: '□', cls: 'px' },
  Y: { label: '△', cls: 'py' },
};

function face(btn: 'A' | 'B' | 'X' | 'Y', style: GamepadStyle): string {
  const m = style === 'playstation' ? PS[btn] : XBOX[btn];
  return `<span class="glyph pad ${m.cls}">${m.label}</span>`;
}

function shoulder(name: 'LB' | 'RB' | 'LT' | 'RT', style: GamepadStyle): string {
  const ps: Record<string, string> = { LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2' };
  return `<span class="glyph pill">${style === 'playstation' ? ps[name] : name}</span>`;
}

function stick(name: 'L' | 'R', click = false, style: GamepadStyle = 'xbox'): string {
  const label = click ? (style === 'playstation' ? `${name}3` : `${name}S`) : name;
  return `<span class="glyph stick${click ? ' click' : ''}">${label}</span>`;
}

function menuBtn(style: GamepadStyle): string {
  return `<span class="glyph pill">${style === 'playstation' ? 'OPTIONS' : '☰'}</span>`;
}

const TOUCH: Record<PromptAction, string> = {
  move: 'Left stick',
  camera: 'Drag right side',
  zoom: 'Pinch',
  sprint: 'Push stick to edge',
  walk: 'Tilt stick gently',
  dodge: '⟲',
  attackLight: '⚔',
  attackHeavy: '⚔⚔',
  lockOn: '◎',
  interact: '✋',
  pause: '❚❚',
};

export function glyph(action: PromptAction, device: DeviceKind, style: GamepadStyle): string {
  if (device === 'touch') return `<span class="glyph touch">${TOUCH[action]}</span>`;
  if (device === 'gamepad') {
    switch (action) {
      case 'move':
        return stick('L');
      case 'camera':
        return stick('R');
      case 'zoom':
        return `<span class="glyph pill">D-pad ↑↓</span>`;
      case 'sprint':
        return stick('L', true, style);
      case 'walk':
        return stick('L');
      case 'dodge':
        return face('A', style);
      case 'attackLight':
        return `${face('X', style)}<span class="glyph-or">/</span>${shoulder('RB', style)}`;
      case 'attackHeavy':
        return `${face('Y', style)}<span class="glyph-or">/</span>${shoulder('RT', style)}`;
      case 'lockOn':
        return `${stick('R', true, style)}<span class="glyph-or">/</span>${shoulder('LB', style)}`;
      case 'interact':
        return face('B', style);
      case 'pause':
        return menuBtn(style);
    }
  }
  switch (action) {
    case 'move':
      return `${key('W')}${key('A')}${key('S')}${key('D')}`;
    case 'camera':
      return `${mouse('M')}<span class="glyph-or">drag /</span>${key('Q')}${key('E')}`;
    case 'zoom':
      return mouse('W');
    case 'sprint':
      return key('Shift', true);
    case 'walk':
      return key('C');
    case 'dodge':
      return key('Space', true);
    case 'attackLight':
      return mouse('L');
    case 'attackHeavy':
      return mouse('R');
    case 'lockOn':
      return `${key('Tab', true)}<span class="glyph-or">/</span>${mouse('M')}`;
    case 'interact':
      return key('F');
    case 'pause':
      return key('Esc', true);
  }
}

export const ACTION_LABELS: Record<PromptAction, string> = {
  move: 'Move',
  camera: 'Rotate camera',
  zoom: 'Zoom',
  sprint: 'Sprint',
  walk: 'Walk',
  dodge: 'Dodge roll',
  attackLight: 'Light attack',
  attackHeavy: 'Heavy attack',
  lockOn: 'Lock on',
  interact: 'Interact',
  pause: 'Pause',
};
