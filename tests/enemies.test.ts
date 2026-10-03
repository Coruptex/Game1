import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/world/physics/PhysicsWorld';
import { Player, emptyIntent } from '../src/player/Player';
import { EnemyManager } from '../src/enemies/EnemyManager';
import { CombatSystem } from '../src/combat/CombatSystem';

const flat = new PhysicsWorld({ heightAt: () => 0, slopeAt: () => 0, surfaceAt: () => 'grass', waterLevelAt: () => -10 });

function setup() {
  const scene = new THREE.Scene();
  const combat = new CombatSystem({ onHit: () => undefined });
  const player = new Player(flat);
  player.teleport(0, 0, 0);
  combat.register(player);
  const mgr = new EnemyManager(scene, flat, combat, player, {});
  mgr.spawnAll([
    { type: 'pirateSwordsman', x: 0, z: 3, yaw: Math.PI },
    { type: 'pirateSwordsman', x: 2.5, z: 2.5, yaw: Math.PI },
  ]);
  return { player, mgr, combat };
}

describe('Enemy AI integration', () => {
  it('detects, approaches and attacks the player, damaging them', () => {
    const { player, mgr, combat } = setup();
    for (let i = 0; i < 60 * 6; i++) {
      player.update(1 / 60, emptyIntent());
      mgr.update(1 / 60);
      combat.update();
    }
    expect(player.health.current).toBeLessThan(player.health.max);
  });

  it('only one enemy attacks at a time, and the token is freed when the attacker dies', () => {
    const { player, mgr, combat } = setup();
    let maxSimultaneous = 0;
    let killed = false;
    for (let i = 0; i < 60 * 12; i++) {
      player.update(1 / 60, emptyIntent());
      player.health.current = player.health.max; // keep the player alive
      mgr.update(1 / 60);
      combat.update();
      const attacking = mgr.enemies.filter((e) => e.attack && !e.isDead).length;
      maxSimultaneous = Math.max(maxSimultaneous, attacking);
      // kill the first attacker mid-swing once
      const attacker = mgr.enemies.find((e) => e.attack && !e.isDead);
      if (!killed && attacker && attacker.attackTime > 0.2) {
        attacker.health.current = 0.0001;
        attacker.health.damage(1);
        attacker.cancelAttack();
        attacker.ai.onDeath();
        killed = true;
      }
    }
    expect(maxSimultaneous).toBe(1);
    expect(killed).toBe(true);
    const survivor = mgr.enemies.find((e) => !e.isDead)!;
    // the survivor must still be able to attack after its comrade died holding the token
    let survivorAttacked = false;
    for (let i = 0; i < 60 * 8; i++) {
      player.update(1 / 60, emptyIntent());
      player.health.current = player.health.max;
      mgr.update(1 / 60);
      combat.update();
      if (survivor.attack) survivorAttacked = true;
    }
    expect(survivorAttacked).toBe(true);
  });

  it('player light attacks damage and eventually kill an enemy', () => {
    const { player, mgr, combat } = setup();
    const target = mgr.enemies[0];
    mgr.enemies[1].health.current = 0; // keep it simple: one opponent
    let intent = emptyIntent();
    for (let i = 0; i < 60 * 15 && !target.isDead; i++) {
      intent = emptyIntent();
      // face the target and attack every half second
      player.lockTarget = target;
      if (i % 30 === 0) intent.light = true;
      player.update(1 / 60, intent);
      player.health.current = player.health.max;
      mgr.update(1 / 60);
      combat.update();
    }
    expect(target.isDead).toBe(true);
  });
});
