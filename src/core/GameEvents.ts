import type { DeviceKind, GamepadStyle } from '../input/InputActions';

/** Every cross-system event. Payloads are plain data so listeners never need system internals. */
export interface GameEvents {
  'game:started': Record<string, never>;
  'game:paused': { paused: boolean };

  'player:damaged': { amount: number; hp: number; maxHp: number };
  'player:died': Record<string, never>;
  'player:respawned': { checkpointId: string | null };
  'player:staminaFail': Record<string, never>;

  'enemy:alerted': { id: number; x: number; z: number };
  'enemy:damaged': { id: number; amount: number; hp: number; maxHp: number };
  'enemy:killed': { id: number; name: string; gold: number; x: number; y: number; z: number };

  'combat:hit': { attackerIsPlayer: boolean; heavy: boolean; x: number; y: number; z: number };
  'combat:swing': { isPlayer: boolean; heavy: boolean; x: number; y: number; z: number };

  'chest:opened': { id: string; gold: number };
  'checkpoint:rested': { id: string; firstTime: boolean };
  'gold:changed': { gold: number; delta: number };

  'region:entered': { id: string; name: string; subtitle?: string; firstVisit: boolean };
  'interaction:focus': { label: string | null; verb: string | null };
  'message': { text: string; kind: 'info' | 'warning' };

  'input:device': { device: DeviceKind; style: GamepadStyle };
  'lockon:changed': { active: boolean };
}
