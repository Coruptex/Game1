import * as THREE from 'three';
import { GameTime } from './Time';
import { EventBus } from './EventBus';
import type { GameEvents } from './GameEvents';
import { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import { GlobalUniforms } from '../assets/materials/GlobalUniforms';
import { RenderPipeline } from '../render/RenderPipeline';
import { detectDefaultQuality, type QualityLevel } from '../render/Quality';
import { InputManager } from '../input/InputManager';
import { CameraController } from '../camera/CameraController';
import { Sky } from '../environment/sky/Sky';
import { ATMOSPHERES, LightingRig } from '../environment/sky/LightingRig';
import { WorldManager } from '../world/WorldManager';
import { HarborHubArea } from '../world/areas/harbor/HarborHub';
import type { BuiltArea, InteractableSpawn } from '../world/areas/AreaTypes';
import { Player, emptyIntent, type PlayerIntent } from '../player/Player';
import { PLAYER_TUNING } from '../player/PlayerConfig';
import { ATTACKS } from '../combat/AttackDefs';
import { CombatSystem } from '../combat/CombatSystem';
import { LockOnSystem } from '../combat/LockOnSystem';
import { EnemyManager } from '../enemies/EnemyManager';
import type { Enemy } from '../enemies/Enemy';
import { Effects } from '../effects/Effects';
import { InteractionSystem } from '../interaction/InteractionSystem';
import type { InteractionServices } from '../interaction/InteractionServices';
import { TreasureChest } from '../interaction/objects/TreasureChest';
import { EmberShrine } from '../interaction/objects/EmberShrine';
import { SealedDoor } from '../interaction/objects/SealedDoor';
import { GameState } from '../systems/GameState';
import { UIManager } from '../ui/UIManager';
import { NullAudio, type GameAudio } from '../audio/AudioTypes';
import { AMBIENCE_PRESETS } from '../audio/Ambience';
import type { Character, HitInfo, HitResult } from '../characters/Character';
import { Rng, hashString } from '../utils/random';
import type { SurfaceType } from '../world/physics/PhysicsTypes';

export type GameState_ = 'loading' | 'title' | 'playing';

interface Timer {
  t: number;
  fn: () => void;
}

/**
 * Root object: owns every system and runs the frame loop.
 * Update order: input -> player -> enemies -> combat -> interactions -> world -> camera -> render.
 */
export class Game {
  readonly scene = new THREE.Scene();
  readonly time = new GameTime();
  readonly events = new EventBus<GameEvents>();
  readonly materials = new MaterialLibrary();
  readonly input: InputManager;
  readonly cameraController: CameraController;
  readonly pipeline: RenderPipeline;
  readonly sky: Sky;
  readonly lighting: LightingRig;
  readonly world: WorldManager;
  readonly effects: Effects;
  readonly ui: UIManager;
  readonly state = new GameState();
  readonly interactions = new InteractionSystem();
  audio: GameAudio = new NullAudio();

  area!: BuiltArea;
  player!: Player;
  enemies!: EnemyManager;
  combat!: CombatSystem;
  lockOn!: LockOnSystem;
  phase: GameState_ = 'loading';
  paused = false;

  private readonly fxLight: THREE.PointLight;
  private fxLightTimer = 0;
  private fxLightDuration = 1;
  private fxLightPeak = 0;
  private readonly shrineLight: THREE.PointLight;
  private readonly timers: Timer[] = [];
  /** Timers in real (unscaled, unpaused-by-hitstop) time, still driven by the frame loop. */
  private readonly realTimers: Timer[] = [];
  private readonly intent: PlayerIntent = emptyIntent();
  private readonly moveDir = new THREE.Vector2();
  private readonly tmp = new THREE.Vector3();
  private readonly rng = new Rng(4242);
  private lastFrame = performance.now();
  private titleOrbit = 0;
  /** When true the requestAnimationFrame loop stops simulating (tests drive frames manually). */
  private externalDrive = false;
  private respawning = false;
  private resting = false;
  private readonly trailColor = 0xbfefff;

  constructor(readonly root: HTMLElement) {
    const quality = detectDefaultQuality();
    this.cameraController = new CameraController(root.clientWidth / Math.max(1, root.clientHeight), {
      heightAt: (x, z) => this.area?.ground.heightAt(x, z) ?? 0,
    });
    this.pipeline = new RenderPipeline(root, this.scene, this.cameraController.camera, quality);
    this.input = new InputManager(root);
    this.ui = new UIManager(root, this.input);
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.lighting = new LightingRig(this.scene, this.sky);
    this.applyShadowQuality();
    this.world = new WorldManager(this.scene, this.materials, this.events);
    this.world.register(HarborHubArea);
    this.effects = new Effects(this.scene);

    // Fixed light budget (adding/removing lights at runtime forces shader recompiles).
    this.fxLight = new THREE.PointLight(0xffc860, 0, 14, 1.6);
    this.scene.add(this.fxLight);
    this.shrineLight = new THREE.PointLight(0xff9a3a, 14, 16, 1.5);

    this.state.persistent = !new URLSearchParams(location.search).has('nosave');
    this.state.load();

    window.addEventListener('resize', () => this.onResize());
    this.onResize();
    this.input.onDeviceChanged((device, style) => this.events.emit('input:device', { device, style }));
  }

  private applyShadowQuality(): void {
    const q = this.pipeline.quality;
    this.lighting.configureShadows(q.shadowMapSize, q.shadowRadius, q.shadowExtent);
    GlobalUniforms.uCausticStrength.value = q.caustics ? 1 : 0;
  }

  private onResize(): void {
    const h = this.root.clientHeight * this.pipeline.renderer.getPixelRatio();
    this.effects.particles.setViewport(h, this.cameraController.camera.fov);
  }

  setAudio(audio: GameAudio): void {
    this.audio = audio;
  }

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    const yieldFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    this.area = await this.world.load('harbor', this.pipeline.quality, async (f, label) => {
      this.ui.setLoading(f * 0.85, label);
      await yieldFrame();
    });

    this.ui.setLoading(0.88, 'Summoning the crew');
    await yieldFrame();
    this.combat = new CombatSystem({ onHit: (a, t, h, r) => this.onCombatHit(a, t, h, r) });
    this.lockOn = new LockOnSystem(this.area.physics);
    this.player = new Player(this.area.physics);
    this.scene.add(this.player.root);
    this.combat.register(this.player);
    this.wirePlayer();
    const sp = this.state.respawn ?? { x: this.area.spawn.x, z: this.area.spawn.z, yaw: this.area.spawn.yaw };
    this.player.respawnAt(sp.x, sp.z, sp.yaw, false);

    this.enemies = new EnemyManager(this.scene, this.area.physics, this.combat, this.player, {
      onDamaged: (e, hit, staggered) => this.onEnemyDamaged(e, hit, staggered),
      onDeath: (e) => this.onEnemyDeath(e),
      onAlert: (e) => {
        this.audio.play('enemyAlert', { position: e.position });
        this.events.emit('enemy:alerted', { id: e.id, x: e.position.x, z: e.position.z });
      },
      onAttackStart: () => undefined,
    });
    this.enemies.spawnAll(this.area.enemySpawns);
    for (const e of this.enemies.enemies) this.wireCharacter(e);
    this.wireCharacter(this.player);

    this.createInteractables(this.area.interactables);
    this.interactions.onFocus((it) => {
      const p = it?.prompt() ?? null;
      this.ui.setPrompt(p);
      this.input.touch.setInteractAvailable(!!p);
      this.events.emit('interaction:focus', { label: p?.label ?? null, verb: p?.verb ?? null });
    });

    const regionShown = new Map<string, number>();
    this.events.on('region:entered', (r) => {
      // Soulslike area titles: on discovery, and again only after a long absence.
      const last = regionShown.get(r.id) ?? -Infinity;
      if (this.phase === 'playing' && this.time.realElapsed - last > 120) {
        regionShown.set(r.id, this.time.realElapsed);
        this.ui.regionBanner(r.name, r.subtitle);
        if (r.firstVisit) this.audio.play('regionDiscovered');
      }
    });

    this.ui.setGold(this.state.gold, true);
    this.ui.setLoading(0.95, 'Compiling shaders');
    await yieldFrame();
    this.cameraController.snapTo(this.player.position, this.area.spawn.cameraYaw);
    this.lighting.snapToProfile(ATMOSPHERES.harbor);
    this.pipeline.precompile();
    this.ui.setLoading(1, 'Ready');
    this.phase = 'title';
    this.ui.showTitlePrompt(() => void this.beginPlay(), this.state.hasSave);
  }

  private async beginPlay(): Promise<void> {
    void this.audio.unlock();
    this.audio.play('uiConfirm');
    this.phase = 'playing';
    this.cameraController.snapTo(this.player.position, this.area.spawn.cameraYaw);
    this.ui.setHUDVisible(true);
    this.world.currentRegion = null; // re-announce the starting region
    this.events.emit('game:started', {});
  }

  private createInteractables(spawns: InteractableSpawn[]): void {
    const svc = this.services();
    for (const s of spawns) {
      const y = this.area.physics.groundAt(s.x, s.z, 50).height;
      if (s.kind === 'chest') {
        const chest = new TreasureChest(s.id, s.x, y, s.z, s.yaw, s.gold, svc, this.area.chestParts?.(hashString(s.id) % 1000));
        this.scene.add(chest.object);
        this.area.physics.addBox(s.x, s.z, 0.6, 0.42, s.yaw, y, y + 0.9, 'chest');
        this.interactions.add(chest);
      } else if (s.kind === 'shrine') {
        const shrine = new EmberShrine(s.id, s.x, y, s.z, s.yaw, svc, this.shrineLight, this.area.shrineModel?.());
        this.scene.add(shrine.object);
        this.area.physics.addCircle(s.x, s.z, 0.85, y, y + 1.8, 'shrine');
        this.interactions.add(shrine);
      } else if (s.kind === 'sealedDoor') {
        this.interactions.add(new SealedDoor(s.id, s.x, y, s.z, s.targetArea, s.message, svc));
      }
    }
  }

  private services(): InteractionServices {
    return {
      player: this.player,
      state: this.state,
      events: this.events,
      effects: this.effects,
      sfx: { play: (id, o) => this.audio.play(id, o) },
      materials: this.materials,
      flashLight: (pos, color, intensity, duration) => this.flashLight(pos, color, intensity, duration),
      banner: (text, kind) => {
        this.ui.banner(text, kind);
        this.audio.play(kind === 'ember' ? 'regionDiscovered' : 'victory');
      },
      restAtShrine: (id, x, z, yaw) => this.restAtShrine(id, x, z, yaw),
      addGold: (amount) => this.addGold(amount),
      travelTo: (area) => this.travelTo(area),
      after: (s, fn) => this.after(s, fn),
      message: (text) => this.ui.toast(text, 4.5),
    };
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  private wirePlayer(): void {
    const p = this.player;
    p.events = {
      onAttackStart: (def) => {
        this.audio.play(def.heavy ? 'swordSwingHeavy' : 'swordSwing', { position: p.position });
        this.effects.trail(p.id, this.trailColor).clear();
      },
      onDodge: (roll) => {
        this.audio.play('dodgeRoll', { position: p.position });
        if (roll) this.after(0.12, () => this.effects.particles.burst(p.ground.waterDepth > 0.1 ? 'splash' : 'dust', p.position, 6));
      },
      onStaminaFail: () => {
        this.ui.flashStamina();
        this.audio.play('staminaEmpty');
        this.events.emit('player:staminaFail', {});
      },
      onDamaged: (_hit, _staggered) => {
        this.events.emit('player:damaged', { amount: 0, hp: p.health.current, maxHp: p.health.max });
      },
      onDeath: () => this.onPlayerDeath(),
    };
  }

  private wireCharacter(c: Character): void {
    c.onFootstep = (ch, surface, depth) => this.onFootstep(ch, surface, depth);
    c.onTelegraph = (ch) => {
      // readable wind-up: a bright glint on the blade + a warning sound
      const base = this.tmp;
      const tip = new THREE.Vector3();
      if (ch.rig.getBladeWorld(base, tip)) this.effects.particles.burst('glint', tip, 1, { sizeScale: 0.9 });
      this.audio.play('enemyTelegraph', { position: ch.position });
    };
  }

  private onFootstep(c: Character, surface: SurfaceType, depth: number): void {
    const id =
      depth > 0.1 || surface === 'water'
        ? 'footstepWater'
        : surface === 'wood'
          ? 'footstepWood'
          : surface === 'stone' || surface === 'rock'
            ? 'footstepStone'
            : surface === 'sand'
              ? 'footstepSand'
              : 'footstepGrass';
    const isPlayer = c === this.player;
    this.audio.play(id, { position: c.position, volume: isPlayer ? 0.55 : 0.4 });
    if (depth > 0.1) this.effects.particles.burst('splash', c.position, 3, { speedScale: 0.6 });
    else if (surface === 'sand' || surface === 'dirt') {
      if (c.velocity.length() > 4) this.effects.particles.burst('dust', c.position, 1, { sizeScale: 0.7 });
    }
  }

  private onCombatHit(attacker: Character, target: Character, hit: HitInfo, result: HitResult): void {
    if (result === 'evaded' || result === 'ignored') return;
    const heavy = hit.heavy;
    this.time.hitStop(hit.attack.hitStop * (result === 'killed' ? 1.6 : 1));
    this.effects.particles.burst('spark', hit.point, heavy ? 22 : 14, { dir: new THREE.Vector3(hit.dirX, 0.3, hit.dirZ), spread: 0.9 });
    this.effects.particles.burst('blood', hit.point, heavy ? 10 : 6, { dir: new THREE.Vector3(hit.dirX, 0.4, hit.dirZ), spread: 0.7 });
    const targetIsPlayer = target === this.player;
    if (targetIsPlayer) {
      this.cameraController.addTrauma(heavy ? 0.6 : 0.42);
      this.audio.play('playerHurt', { position: target.position });
      this.input.gamepad.rumble(0.8, 0.5, 220);
    } else {
      this.cameraController.addTrauma(heavy ? 0.32 : 0.16);
      this.input.gamepad.rumble(heavy ? 0.6 : 0.3, 0.3, heavy ? 160 : 90);
    }
    this.audio.play(heavy ? 'swordHitHeavy' : 'swordHitFlesh', { position: hit.point });
    this.events.emit('combat:hit', { attackerIsPlayer: attacker === this.player, heavy, x: hit.point.x, y: hit.point.y, z: hit.point.z });
  }

  private onEnemyDamaged(e: Enemy, _hit: HitInfo, staggered: boolean): void {
    this.audio.play('enemyHurt', { position: e.position, volume: staggered ? 1 : 0.7 });
    this.events.emit('enemy:damaged', { id: e.id, amount: 0, hp: e.health.current, maxHp: e.health.max });
  }

  private onEnemyDeath(e: Enemy): void {
    const gold = Math.round(this.rng.range(e.def.gold[0], e.def.gold[1]));
    this.audio.play('enemyDeath', { position: e.position });
    this.after(0.9, () => this.audio.play('bodyFall', { position: e.position }));
    this.state.kills++;
    this.addGold(gold);
    if (this.state.kills === 1) this.ui.banner('Enemy Felled', 'victory', 2.6);
    else this.ui.toast(`${e.name} defeated — +${gold} Doubloons`, 2.6);
    this.after(2.6, () => {
      const p = e.position.clone();
      p.y += 0.6;
      this.effects.particles.burst('soul', p, 18);
    });
    this.events.emit('enemy:killed', { id: e.id, name: e.name, gold, x: e.position.x, y: e.position.y, z: e.position.z });
  }

  private addGold(amount: number): void {
    this.state.gold += amount;
    this.ui.setGold(this.state.gold);
    this.events.emit('gold:changed', { gold: this.state.gold, delta: amount });
    this.state.save();
  }

  private onPlayerDeath(): void {
    this.state.deaths++;
    this.lockOn.clear();
    this.events.emit('lockon:changed', { active: false });
    this.audio.play('playerDeath', { position: this.player.position });
    this.time.timeScale = 0.55;
    this.after(0.9, () => {
      this.time.timeScale = 1;
      this.ui.banner('You Died', 'death', 3.6);
      this.audio.play('youDied');
    });
    this.events.emit('player:died', {});
  }

  private respawnAfterDeath(): void {
    if (this.respawning) return;
    this.respawning = true;
    this.ui.fadeTo(1, 1.2);
    this.afterReal(1.3, () => {
      const r = this.state.respawn ?? { x: this.area.spawn.x, z: this.area.spawn.z, yaw: this.area.spawn.yaw, shrineId: null };
      this.enemies.resetAll();
      this.effects.clear();
      this.player.respawnAt(r.x, r.z, r.yaw, true);
      this.cameraController.snapTo(this.player.position, r.yaw + Math.PI);
      this.state.save();
      this.events.emit('player:respawned', { checkpointId: r.shrineId });
      this.ui.fadeTo(0, 1.0);
      this.afterReal(0.6, () => {
        this.respawning = false;
      });
    });
  }

  private restAtShrine(id: string, x: number, z: number, yaw: number): void {
    if (this.resting) return;
    this.resting = true;
    this.afterReal(0.65, () => this.ui.fadeTo(1, 0.6));
    this.afterReal(1.3, () => {
      this.player.health.reset();
      this.player.stamina.restore();
      this.enemies.resetAll();
      this.effects.clear();
      this.state.respawn = { x, z, yaw, shrineId: id };
      this.state.save();
      this.ui.toast('Health restored. The island stirs once more…', 4);
      this.events.emit('checkpoint:rested', { id, firstTime: false });
      this.ui.fadeTo(0, 0.8);
      this.afterReal(0.5, () => {
        this.resting = false;
      });
    });
  }

  /**
   * Area transitions (dungeons, other islands). Returns false when the target area has not been
   * registered with the WorldManager yet, so doors can stay sealed in-world.
   */
  travelTo(areaId: string): boolean {
    if (!this.world.has(areaId) || areaId === this.area.id || this.respawning) return false;
    this.respawning = true;
    this.ui.fadeTo(1, 0.8);
    this.afterReal(0.85, async () => {
      this.enemies.dispose();
      this.interactions.clear();
      this.lockOn.clear();
      this.area = await this.world.load(areaId, this.pipeline.quality, async () => undefined);
      this.lockOn = new LockOnSystem(this.area.physics);
      this.player.setPhysics(this.area.physics);
      this.enemies = new EnemyManager(this.scene, this.area.physics, this.combat, this.player, {
        onDamaged: (e, hit, st) => this.onEnemyDamaged(e, hit, st),
        onDeath: (e) => this.onEnemyDeath(e),
      });
      this.enemies.spawnAll(this.area.enemySpawns);
      for (const e of this.enemies.enemies) this.wireCharacter(e);
      this.createInteractables(this.area.interactables);
      this.player.respawnAt(this.area.spawn.x, this.area.spawn.z, this.area.spawn.yaw, false);
      this.cameraController.snapTo(this.player.position, this.area.spawn.cameraYaw);
      this.ui.fadeTo(0, 0.8);
      this.respawning = false;
    });
    return true;
  }

  private flashLight(pos: THREE.Vector3, color: number, intensity: number, duration: number): void {
    this.fxLight.position.copy(pos);
    this.fxLight.color.set(color);
    this.fxLightPeak = intensity;
    this.fxLightDuration = duration;
    this.fxLightTimer = duration;
  }

  after(seconds: number, fn: () => void): void {
    this.timers.push({ t: seconds, fn });
  }

  /** Schedules a callback in real time (fades, transitions); paused while the game is paused. */
  afterReal(seconds: number, fn: () => void): void {
    this.realTimers.push({ t: seconds, fn });
  }

  private tickTimers(list: Timer[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      t.t -= dt;
      if (t.t <= 0) {
        list.splice(i, 1);
        t.fn();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  start(): void {
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      const dt = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      if (!this.externalDrive) this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** One full frame (simulation + render). */
  frame(realDt: number, render = true): void {
    this.time.paused = this.paused;
    this.time.tick(realDt);
    this.input.update(this.time.realDelta);
    const dt = this.time.delta;

    if (this.phase === 'playing') {
      this.handleMetaInput();
      if (!this.paused) this.simulate(dt);
    } else if (this.phase === 'title') {
      this.titleOrbit += this.time.realDelta;
      this.world.update(dt, this.time.elapsed, this.player.position);
      this.interactions.update(dt, this.player, false);
      this.enemies.update(dt);
      this.effects.update(dt);
    }

    this.updateCamera();
    this.lighting.update(this.time.realDelta, this.player?.position ?? this.cameraController.focus);
    this.sky.update(this.cameraController.camera);
    this.updateFxLight(this.time.realDelta);
    this.updateGlobalUniforms();
    this.ui.update(this.time.realDelta);
    if (this.phase === 'playing') this.updateHUD();
    if (this.player) {
      const cam = this.cameraController;
      this.audio.update(this.time.realDelta, { x: cam.focus.x, y: cam.focus.y, z: cam.focus.z, yaw: cam.yaw });
    }
    if (render) this.pipeline.render();
    this.input.endFrame();
  }

  private handleMetaInput(): void {
    const inp = this.input;
    if (inp.wasPressed('pause') && !this.ui.titleVisible) {
      if (this.paused) this.resume();
      else this.pause();
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.input.reset();
    this.audio.play('uiMove');
    this.ui.openPause({
      onResume: () => this.resume(),
      onToggleSound: () => {
        this.audio.setMuted(!this.audio.muted);
        return this.audio.muted;
      },
      onQuality: (level) => this.setQuality(level),
      onRestart: () => this.restartJourney(),
      isMuted: () => this.audio.muted,
      quality: () => this.pipeline.quality.level,
    });
    this.events.emit('game:paused', { paused: true });
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.ui.closePause();
    this.audio.play('uiBack');
    this.events.emit('game:paused', { paused: false });
  }

  setQuality(level: QualityLevel): void {
    this.pipeline.setQuality(level);
    this.applyShadowQuality();
    this.onResize();
  }

  private restartJourney(): void {
    this.state.reset();
    location.reload();
  }

  private simulate(dt: number): void {
    this.tickTimers(this.timers, dt);
    this.tickTimers(this.realTimers, this.time.realDelta);

    const inp = this.input;
    const cam = this.cameraController;
    const p = this.player;
    const canAct = !this.respawning && !this.resting;

    // --- intent -----------------------------------------------------------------
    cam.toWorldDirection(inp.move.x, inp.move.y, this.moveDir);
    const it = this.intent;
    it.moveX = canAct ? this.moveDir.x : 0;
    it.moveZ = canAct ? this.moveDir.y : 0;
    it.sprint = canAct && inp.isHeld('sprint');
    it.light = canAct && inp.wasPressed('attackLight');
    it.heavy = canAct && inp.wasPressed('attackHeavy');
    it.dodge = canAct && inp.wasPressed('dodge');

    // --- lock-on ------------------------------------------------------------------
    if (canAct && inp.wasPressed('lockOn') && !p.isDead) {
      const t = this.lockOn.toggle(p, this.enemies.alive, cam.forwardX, cam.forwardZ);
      this.audio.play(t ? 'lockOn' : 'lockOff');
      this.events.emit('lockon:changed', { active: !!t });
    }
    const lockUpdate = this.lockOn.update(p, this.enemies.alive, cam.forwardX, cam.forwardZ);
    if (lockUpdate.changed) this.events.emit('lockon:changed', { active: !!this.lockOn.target });
    p.lockTarget = this.lockOn.target;
    this.input.touch.setLockActive(!!this.lockOn.target);

    // --- interaction ----------------------------------------------------------------
    if (canAct && inp.wasPressed('interact') && p.canInteract) {
      if (this.interactions.tryInteract()) this.audio.play('uiConfirm');
    }

    // --- simulation ---------------------------------------------------------------------
    p.update(dt, it);
    if (p.trailActive) this.effects.trail(p.id, this.trailColor).push(p.trailBase, p.trailTip);
    this.enemies.update(dt);
    for (const e of this.enemies.enemies) {
      if (e.attack && !e.isDead) {
        const t = e.attackTime;
        const active = e.attack.windows.some(([s, en]) => t >= s - 0.05 && t <= en + 0.05);
        if (active) {
          const b = new THREE.Vector3();
          const tip = new THREE.Vector3();
          if (e.rig.getBladeWorld(b, tip)) this.effects.trail(e.id, e.def.trailColor).push(b, tip);
        }
      }
    }
    this.combat.update();
    this.interactions.update(dt, p, canAct && p.canInteract);
    const region = this.world.update(dt, this.time.elapsed, p.position);
    if (region) {
      this.lighting.setProfile(ATMOSPHERES[region.atmosphere] ?? ATMOSPHERES.harbor);
      this.audio.setAmbience(AMBIENCE_PRESETS[region.ambience]);
    }
    this.updateEmitters(dt);
    this.effects.update(dt);

    if (p.isDead && p.deadTime > PLAYER_TUNING.deathDelay && !this.respawning) this.respawnAfterDeath();
  }

  private readonly emitterAcc = new Map<object, number>();

  /** Drives the area's ambient particle emitters near the player. */
  private updateEmitters(dt: number): void {
    const list = this.area.emitters;
    if (!list) return;
    const p = this.player.position;
    for (const em of list) {
      const dx = em.x - p.x;
      const dz = em.z - p.z;
      if (dx * dx + dz * dz > em.range * em.range) continue;
      let acc = (this.emitterAcc.get(em) ?? 0) + dt * em.rate;
      while (acc >= 1) {
        acc -= 1;
        this.tmp.set(em.x + this.rng.range(-em.spread, em.spread), em.y, em.z + this.rng.range(-em.spread, em.spread));
        this.effects.particles.burst(em.kind, this.tmp, 1, { speedScale: em.kind === 'splash' ? 0.7 : 1 });
      }
      this.emitterAcc.set(em, acc);
    }
  }

  private updateCamera(): void {
    const cam = this.cameraController;
    if (!this.player) return;
    if (this.phase === 'title') {
      // slow establishing shot of the area behind the title screen
      const shot = this.area.titleShot;
      if (shot) {
        const t = this.titleOrbit;
        const a = shot.yaw + Math.sin(t * 0.045) * shot.swing;
        const camera = cam.camera;
        camera.position.set(shot.x + Math.sin(a) * shot.radius, shot.height + Math.sin(t * 0.07) * 1.2, shot.z + Math.cos(a) * shot.radius);
        camera.lookAt(shot.lookX, shot.lookY, shot.lookZ);
        return;
      }
      cam.setDistance(26);
      cam.update(this.time.realDelta, { lookYaw: 0, lookPitch: 0, zoom: 0 }, this.player.position, null);
      cam.yaw = this.area.spawn.cameraYaw + Math.sin(this.titleOrbit * 0.05) * 0.6;
      return;
    }
    const input = this.paused || this.respawning ? null : this.input;
    const lock = this.lockOn.target ? this.lockOn.target.position : null;
    cam.update(this.time.realDelta, input, this.player.position, lock);
  }

  private updateFxLight(dt: number): void {
    if (this.fxLightTimer > 0) {
      this.fxLightTimer -= dt;
      const k = Math.max(0, this.fxLightTimer / this.fxLightDuration);
      this.fxLight.intensity = this.fxLightPeak * k * k;
    } else {
      this.fxLight.intensity = 0;
    }
  }

  private updateHUD(): void {
    const p = this.player;
    this.ui.updateBars(p.health, p.stamina);
    const targets = this.enemies.enemies.map((e) => ({
      id: e.id,
      name: e.name,
      position: e.position,
      height: e.stats.height,
      health: e.health,
      visible: !e.isDead && !e.removed && (e.barTimer > 0 || e === this.lockOn.target || (e.ai.isAware && e.health.current < e.health.max)),
    }));
    const lp = this.lockOn.target ? this.lockOn.target.chestPosition(this.tmp) : null;
    this.ui.updateWorldUI(targets, lp, this.cameraController.camera);
  }

  private updateGlobalUniforms(): void {
    GlobalUniforms.uTime.value = this.time.elapsed;
    GlobalUniforms.uCamPos.value.copy(this.cameraController.camera.position);
    if (this.player) {
      const p = this.player.position;
      GlobalUniforms.uFocusPos.value.set(p.x, p.y + 1.1, p.z);
    }
    GlobalUniforms.uSeeThroughStrength.value = this.phase === 'playing' ? 1 : 0;
    const g = this.pipeline.gradingUniforms;
    g.uSaturation.value = this.lighting.saturation;
    g.uDesaturate.value = this.player?.isDead ? Math.min(0.55, this.player.deadTime * 0.3) : 0;
    this.pipeline.renderer.toneMappingExposure = this.lighting.exposure;
  }

  // -------------------------------------------------------------------------
  // Debug / automation API (exposed as window.__game in dev or with ?debug)
  // -------------------------------------------------------------------------

  readonly debug = {
    /** Hands frame stepping to the caller (automation): the rAF loop stops simulating/rendering. */
    drive: (external: boolean) => {
      this.externalDrive = external;
    },
    /** Runs the simulation for `seconds` with a fixed step, without rendering. */
    advance: (seconds: number, step = 1 / 60) => {
      const n = Math.ceil(seconds / step);
      for (let i = 0; i < n; i++) this.frame(step, false);
    },
    start: () => {
      if (this.phase === 'title') {
        this.ui.showTitlePrompt(() => undefined, false);
        void this.beginPlay();
        document.querySelector('.title-screen')?.classList.add('hidden');
      }
    },
    teleport: (x: number, z: number, yaw?: number) => this.player.teleport(x, z, yaw),
    /** Places the camera behind the player at `yaw` (automation screenshots). */
    view: (yaw: number, distance?: number) => {
      if (distance !== undefined) this.cameraController.setDistance(distance, true);
      this.cameraController.snapTo(this.player.position, yaw);
    },
    snapshot: () => ({
      phase: this.phase,
      paused: this.paused,
      player: {
        x: +this.player.position.x.toFixed(2),
        y: +this.player.position.y.toFixed(2),
        z: +this.player.position.z.toFixed(2),
        yaw: +this.player.yaw.toFixed(2),
        state: this.player.state,
        hp: this.player.health.current,
        stamina: Math.round(this.player.stamina.current),
        surface: this.player.ground.surface,
      },
      enemies: this.enemies.enemies.map((e) => ({ id: e.id, ai: e.ai.state, hp: e.health.current, dead: e.isDead, x: +e.position.x.toFixed(1), z: +e.position.z.toFixed(1) })),
      gold: this.state.gold,
      focus: this.interactions.focus?.id ?? null,
      lock: this.lockOn.target?.id ?? null,
      region: this.world.currentRegion?.id ?? null,
      respawn: this.state.respawn,
      device: this.input.activeDevice,
    }),
    press: (action: Parameters<InputManager['injectPress']>[0]) => this.input.injectPress(action),
    setHealth: (hp: number) => {
      this.player.health.current = hp;
    },
    /** Kills every enemy within `radius` of the player (or all when omitted). */
    killEnemies: (radius = Infinity) => {
      for (const e of this.enemies.enemies) {
        if (e.isDead || e.position.distanceTo(this.player.position) > radius) continue;
        e.invulnerable = 0;
        e.health.current = 1;
        const hit: HitInfo = { attacker: this.player, attack: ATTACKS.light1, damage: 999, poiseDamage: 0, dirX: 0, dirZ: 1, knockback: 0, heavy: false, point: e.position.clone() };
        const r = e.receiveHit(hit);
        this.onCombatHit(this.player, e, hit, r);
      }
    },
  };
}
