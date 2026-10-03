/**
 * The audio surface the game depends on. The concrete implementation lives in AudioManager;
 * NullAudio keeps everything working (tests, unsupported browsers) without sound.
 */
export interface AmbienceMixLike {
  ocean: number;
  wind: number;
  jungle: number;
  birds: number;
  harbor: number;
}

export interface GameAudio {
  readonly unlocked: boolean;
  muted: boolean;
  unlock(): Promise<void>;
  setMuted(m: boolean): void;
  play(id: string, opts?: { position?: { x: number; y: number; z: number }; volume?: number; pitch?: number }): void;
  setAmbience(mix: Partial<AmbienceMixLike>): void;
  update(dt: number, listener: { x: number; y: number; z: number; yaw: number }): void;
}

export class NullAudio implements GameAudio {
  readonly unlocked = false;
  muted = false;
  async unlock(): Promise<void> {}
  setMuted(m: boolean): void {
    this.muted = m;
  }
  play(): void {}
  setAmbience(): void {}
  update(): void {}
}
