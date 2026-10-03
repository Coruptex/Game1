/**
 * Persistent progression (gold, opened chests, kindled shrines, respawn point).
 * Saved to localStorage so closing the tab keeps your progress.
 */
export interface RespawnPoint {
  x: number;
  z: number;
  yaw: number;
  shrineId: string | null;
}

interface SaveData {
  v: number;
  gold: number;
  openedChests: string[];
  kindled: string[];
  respawn: RespawnPoint | null;
  deaths: number;
  kills: number;
}

const KEY = 'ember.save';
const VERSION = 1;

export class GameState {
  gold = 0;
  deaths = 0;
  kills = 0;
  readonly openedChests = new Set<string>();
  readonly kindledShrines = new Set<string>();
  respawn: RespawnPoint | null = null;
  /** Disable persistence (tests, ?nosave). */
  persistent = true;

  load(): boolean {
    if (!this.persistent) return false;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as SaveData;
      if (d.v !== VERSION) return false;
      this.gold = d.gold ?? 0;
      this.deaths = d.deaths ?? 0;
      this.kills = d.kills ?? 0;
      this.openedChests.clear();
      d.openedChests?.forEach((c) => this.openedChests.add(c));
      this.kindledShrines.clear();
      d.kindled?.forEach((c) => this.kindledShrines.add(c));
      this.respawn = d.respawn ?? null;
      return true;
    } catch {
      return false;
    }
  }

  save(): void {
    if (!this.persistent) return;
    const d: SaveData = {
      v: VERSION,
      gold: this.gold,
      openedChests: Array.from(this.openedChests),
      kindled: Array.from(this.kindledShrines),
      respawn: this.respawn,
      deaths: this.deaths,
      kills: this.kills,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* storage full / disabled */
    }
  }

  get hasSave(): boolean {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  reset(): void {
    this.gold = 0;
    this.deaths = 0;
    this.kills = 0;
    this.openedChests.clear();
    this.kindledShrines.clear();
    this.respawn = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
