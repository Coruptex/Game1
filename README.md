# Ember of Retribution

A stylised, isometric **pirate Soulslike** prototype built with **TypeScript + Three.js** (WebGL2).
All art (characters, ships, jungle, ruins, water, sky) and all sound are generated procedurally in
code. The repository contains no binary assets.

The first playable slice is the harbour hub, **Corsair's Rest**. It contains docks, a boardable
galleon, a beach, a jungle, ancient ruins, a monumental gate, a distant fortress, pirate enemies,
an Ember Shrine checkpoint and treasure chests.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173  (add ?debug for the automation/debug API)
```

Production build (static files in `dist/`, can be served from any static host):

```bash
npm run build
npm run preview      # http://localhost:4173
```

Other scripts: `npm test` (unit tests), `npm run typecheck`.

Requires a browser with WebGL2 (current Chrome, Edge, Firefox, Safari). Useful URL options:
`?quality=low|medium|high` (otherwise auto-detected; also changeable in the pause menu) and
`?nosave` (don't load or save progress).

## Controls

| Action | Keyboard & mouse | Controller (Xbox / PlayStation) | Touch |
| --- | --- | --- | --- |
| Move | `W A S D` | Left stick | Virtual stick (left half) |
| Walk (toggle) | `C` | Tilt the stick gently | Tilt the stick gently |
| Sprint | hold `Shift` | Click `L3` | Push the stick to its edge |
| Rotate camera | hold middle mouse + drag, or `Q` / `E` | Right stick | Drag on the right half |
| Zoom | Mouse wheel | D-pad ↑ / ↓ | Pinch |
| Light attack (combo) | Left mouse | `X` / `RB` (□ / `R1`) | ⚔ button |
| Heavy attack | Right mouse | `Y` / `RT` (△ / `R2`) | ⚔⚔ button |
| Dodge roll / backstep | `Space` | `A` (✕) | ⟲ button |
| Lock on | `Tab` or middle-click | `R3` or `LB` (`L1`) | ◎ button |
| Interact | `F` | `B` (○) | ✋ button |
| Pause | `Esc` | Start / Options | ❚❚ button |

Bindings are configured in `src/input/InputBindings.ts`. The game detects the active device and
switches its button prompts automatically. Touch controls appear as soon as the screen is touched.

## Playing

* You start on the docks. Pirates patrol the pier, the beach camp, the jungle camp, the ruins and
  the gate.
* Combat follows Soulslike rules. Attacks commit you and cost stamina, and light attacks chain
  into a three-hit combo. Rolls have invulnerability frames. Enemies telegraph wind-ups with a
  blade glint, and a heavy hit or two light hits staggers them.
* The **Ember Shrine** in the harbour plaza is the checkpoint. Kindle it to make it your respawn
  point. Resting there restores health and stamina and brings every enemy back.
* Two **treasure chests** are hidden on the island, one on the beach and one in the jungle camp.
* If you die, you respawn at the last shrine and the enemies return.
* Progress (doubloons, opened chests, kindled shrine) is saved in `localStorage`. Use
  *Pause → Restart Journey* to reset it.

## Project layout

```
src/
  core/         Game loop, time (hit-stop), typed event bus
  input/        InputManager + keyboard/mouse, gamepad, touch devices, central bindings
  camera/       isometric orbit camera (rotation, zoom, lock-on framing, shake)
  render/       renderer, shadows, bloom + colour grading, quality presets
  assets/       procedural textures, material library, shader patches, geometry helpers
  characters/   procedural humanoid rig, animator (locomotion + clips + arm IK), Character base
  player/       player state machine + tuning
  combat/       health, stamina, attack data, combat resolution, lock-on
  enemies/      enemy definitions registry, FSM AI, attack coordinator, manager
  world/        world/area manager, terrain, physics, batching/instancing, harbour layout
  environment/  water, sky, lighting, ships, props, vegetation, architecture, ambient life
  effects/      particles, sword trails, flames
  interaction/  interaction system, chest, Ember Shrine, sealed crypt door
  ui/           HUD, prompts, banners, title, pause/controls menus, styles
  audio/        Web Audio synthesis (SFX + ambience)
  systems/      persistent game state
tests/          unit tests (vitest)
scripts/        headless screenshot + scripted playtest tools
docs/           ARCHITECTURE.md, ASSET_GUIDE.md
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the systems fit together and how to add
areas (dungeons), enemy types and assets. [docs/ASSET_GUIDE.md](docs/ASSET_GUIDE.md) describes the
procedural asset contract and the asset viewer (`/viewer.html?asset=<name>` in dev).

## Next milestones

* The **Crypt of the Ember Kings** dungeon. The sealed door already calls the area-transition
  API, so it opens as soon as a `crypt` area is registered.
* More enemy archetypes (heavy pirate, skeletons, island warriors) as new entries in the enemy
  definitions.
* Healing flasks, an inventory and parry, all deliberately left out of this milestone.
