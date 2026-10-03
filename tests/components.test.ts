import { describe, expect, it } from 'vitest';
import { HealthComponent } from '../src/combat/HealthComponent';
import { StaminaComponent } from '../src/combat/StaminaComponent';
import { AttackCoordinator } from '../src/enemies/AttackCoordinator';
import { GameTime } from '../src/core/Time';
import { EventBus } from '../src/core/EventBus';
import { radialDeadzone, detectGamepadStyle } from '../src/input/devices/GamepadInput';
import { ATTACKS } from '../src/combat/AttackDefs';
import { ALL_CLIPS } from '../src/characters/animation/Clips';

describe('HealthComponent', () => {
  it('damages, trails behind and dies', () => {
    const h = new HealthComponent(100);
    expect(h.damage(30)).toBe(30);
    expect(h.current).toBe(70);
    expect(h.trail).toBe(100);
    h.update(0.5);
    expect(h.trail).toBe(100); // still delayed
    h.update(1.0);
    expect(h.trail).toBeLessThan(100);
    h.damage(500);
    expect(h.isDead).toBe(true);
    expect(h.damage(5)).toBe(0);
  });
});

describe('StaminaComponent', () => {
  it('allows actions with any stamina left and becomes exhausted at zero', () => {
    const s = new StaminaComponent(100);
    expect(s.spend(90)).toBe(true);
    expect(s.spend(30)).toBe(true); // Soulslike: a sliver is enough
    expect(s.current).toBe(0);
    expect(s.exhausted).toBe(true);
    expect(s.spend(10)).toBe(false);
    s.update(0.5); // still in exhaustion delay
    expect(s.current).toBe(0);
    for (let i = 0; i < 60; i++) s.update(0.05);
    expect(s.current).toBeGreaterThan(30);
    expect(s.exhausted).toBe(false);
  });
});

describe('AttackCoordinator', () => {
  it('grants a limited number of attack tokens with a gap', () => {
    const c = new AttackCoordinator(1, 0.5);
    expect(c.request(1)).toBe(true);
    expect(c.request(2)).toBe(false);
    c.release(1);
    expect(c.request(2)).toBe(false); // gap
    c.update(0.6);
    expect(c.request(2)).toBe(true);
  });
});

describe('GameTime', () => {
  it('clamps deltas and applies hit-stop', () => {
    const t = new GameTime();
    t.tick(1);
    expect(t.realDelta).toBeCloseTo(GameTime.MAX_DELTA);
    t.hitStop(0.1, 0);
    t.tick(0.05);
    expect(t.delta).toBe(0);
    t.tick(0.06);
    t.tick(0.016);
    expect(t.delta).toBeCloseTo(0.016);
  });
});

describe('EventBus', () => {
  it('delivers typed events and unsubscribes', () => {
    const bus = new EventBus<{ ping: { n: number } }>();
    let got = 0;
    const off = bus.on('ping', (p) => (got += p.n));
    bus.emit('ping', { n: 2 });
    off();
    bus.emit('ping', { n: 5 });
    expect(got).toBe(2);
  });
});

describe('Gamepad helpers', () => {
  it('applies a radial deadzone with rescaling', () => {
    expect(radialDeadzone(0.1, 0.1, 0.2)).toEqual([0, 0]);
    const [x, y] = radialDeadzone(1, 0, 0.2);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
    const [hx] = radialDeadzone(0.6, 0, 0.2);
    expect(hx).toBeCloseTo(0.5);
  });

  it('detects controller families', () => {
    expect(detectGamepadStyle('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)')).toBe('playstation');
    expect(detectGamepadStyle('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(detectGamepadStyle('Generic USB Joystick')).toBe('generic');
  });
});

describe('Attack data', () => {
  it('every attack references an existing clip and has sane timing', () => {
    for (const a of Object.values(ATTACKS)) {
      const clip = ALL_CLIPS[a.clip];
      expect(clip, a.id).toBeDefined();
      for (const [s, e] of a.windows) {
        expect(s).toBeLessThan(e);
        expect(e).toBeLessThanOrEqual(clip.duration);
        expect(e).toBeLessThan(a.endTime);
      }
      if (a.next) expect(ATTACKS[a.next]).toBeDefined();
      expect(a.endTime).toBeLessThanOrEqual(clip.duration + 0.01);
    }
  });
});

