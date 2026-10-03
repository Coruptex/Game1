import * as THREE from 'three';
import type { AssetCatalog, ViewerAsset } from '../environment/PropTypes';
import { HumanoidRig } from './rig/HumanoidRig';
import { PLAYER_APPEARANCE, pirateGruntAppearance, type Appearance } from './rig/Appearance';
import { Animator } from './animation/Animator';
import { ALL_CLIPS, type ClipName } from './animation/Clips';

/**
 * Character previews for the dev viewer.
 *   viewer.html?asset=player&clip=light1&t=0.2   (freeze a clip at time t)
 *   viewer.html?asset=player&clip=light1          (loop a clip)
 *   viewer.html?asset=player&speed=5              (locomotion at 5 m/s)
 *   viewer.html?asset=lineup
 */
function preview(appearances: Appearance[]): ViewerAsset {
  const params = new URLSearchParams(location.search);
  const clip = params.get('clip') as ClipName | null;
  const freeze = params.get('t');
  const speed = Number(params.get('speed') ?? 0);
  const group = new THREE.Group();
  const animators: Animator[] = [];
  appearances.forEach((a, i) => {
    const rig = new HumanoidRig(a);
    rig.object.position.x = (i - (appearances.length - 1) / 2) * 1.6;
    group.add(rig.object);
    const anim = new Animator(rig);
    anim.loco.speed = speed;
    animators.push(anim);
  });
  let clipTimer = 0;
  return {
    kind: 'object',
    object: group,
    update(dt) {
      for (const anim of animators) {
        if (clip && ALL_CLIPS[clip]) {
          const c = ALL_CLIPS[clip];
          if (freeze !== null) {
            anim.play(c, { startTime: Number(freeze), speed: 0, hold: true });
            // force full weight immediately for stills
            for (let k = 0; k < 10; k++) anim.update(0.02);
          } else {
            clipTimer += dt / animators.length;
            if (!anim.currentClip || clipTimer > c.duration + 0.6) {
              anim.play(c);
              clipTimer = 0;
            }
          }
        }
        anim.update(freeze !== null ? 0 : dt);
        anim.rig.update(dt);
      }
    },
  };
}

/** Same clip frozen at several times, side by side: ?asset=clipsheet&clip=light1&times=0,0.15,0.26 */
function clipSheet(): ViewerAsset {
  const params = new URLSearchParams(location.search);
  const clip = ALL_CLIPS[(params.get('clip') ?? 'light1') as ClipName];
  const times = (params.get('times') ?? '0,0.2,0.4').split(',').map(Number);
  const enemy = params.get('enemy') === '1';
  const group = new THREE.Group();
  const anims: Animator[] = [];
  times.forEach((t, i) => {
    const rig = new HumanoidRig(enemy ? pirateGruntAppearance(3) : PLAYER_APPEARANCE);
    rig.object.position.x = (i - (times.length - 1) / 2) * 1.9;
    group.add(rig.object);
    const anim = new Animator(rig);
    anim.play(clip, { startTime: t, speed: 0, hold: true });
    anims.push(anim);
  });
  return {
    kind: 'object',
    object: group,
    update() {
      for (const a of anims) {
        a.update(0.05);
        a.update(0.05);
      }
    },
  };
}

export const assets: AssetCatalog = {
  clipsheet: clipSheet,
  player: () => preview([PLAYER_APPEARANCE]),
  'pirate-0': () => preview([pirateGruntAppearance(1)]),
  lineup: () => preview([PLAYER_APPEARANCE, pirateGruntAppearance(1), pirateGruntAppearance(2), pirateGruntAppearance(3), pirateGruntAppearance(4)]),
};
