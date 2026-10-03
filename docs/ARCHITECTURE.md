# Architecture

*Ember of Retribution* is a code-only game: TypeScript + Three.js (WebGL2) + Vite. There are no
binary assets. Geometry, textures, animation and audio are all generated at runtime.

## Frame loop (`src/core/Game.ts`)

```
input.update → [title | playing] → player.update → enemies.update → combat.update
            → interactions.update → world.update (regions, ambient life) → effects.update
            → camera.update → lighting.update → global uniforms → UI → audio → render
```

* `GameTime` separates **real time** (camera, UI, fades) from **gameplay time**, which supports
  pause, hit-stop and slow motion.
* `Game.after()` schedules gameplay-time callbacks and `Game.afterReal()` schedules real-time ones.
  Both are driven by the frame loop rather than `setTimeout`, so sequences such as death,
  respawn and resting pause correctly and behave deterministically under `debug.advance()`.

## Systems

| Folder | Responsibility |
| --- | --- |
| `core/` | `Game` (composition root + loop), `GameTime`, typed `EventBus`, `GameEvents` |
| `input/` | `InputManager` merges `KeyboardMouseInput`, `GamepadInput`, `TouchInput` into **actions** (`attackLight`, `dodge`, `lockOn`, …) + analog move/look. Bindings live in `InputBindings.ts`. The active device is detected automatically. |
| `camera/` | `CameraController`: elevated orbit camera, 360° yaw, zoom-dependent pitch, lock-on framing, terrain avoidance, trauma shake |
| `render/` | `RenderPipeline` (renderer, PCF shadows, bloom, colour grading), quality presets |
| `assets/` | procedural canvas textures, `MaterialLibrary` + `Palette`, shader patches (wind, see-through dither, caustics, rim, foliage), geometry helpers |
| `characters/` | `HumanoidRig` (parts merged into **one skinned mesh** + ink outline), `Animator` (procedural locomotion + key-framed clips + 2-bone **arm IK** for weapon arcs), `Character` base (movement, attacks with root motion, damage, poise) |
| `player/` | `Player` state machine (move / attack combos / dodge with i-frames / stagger / interact / rest / dead), input buffer, `PlayerConfig` tuning |
| `combat/` | `HealthComponent`, `StaminaComponent`, data-driven `AttackDefs`, `CombatSystem` (hit windows, arcs), `LockOnSystem` |
| `enemies/` | `EnemyDefinitions` registry, `Enemy`, `EnemyAI` FSM, `AttackCoordinator` (attack tokens), `EnemyManager` |
| `world/` | `WorldManager` (areas + regions), `PhysicsWorld` (colliders, walkable platforms, terrain), `Heightfield`/terrain mesh, `StaticBatcher`, `InstancedScatter`, `PropPlacer`, `areas/harbor/*` (see below) |
| `environment/` | water, sky, lighting rig, distant islands, ambient life, and the procedural asset modules (`ships/`, `props/`, `vegetation/`, `architecture/`) |
| `effects/` | pooled GPU particles, sword trails, ember flames |
| `interaction/` | `InteractionSystem`, `TreasureChest`, `EmberShrine` (checkpoint), `SealedDoor` (area transition) |
| `ui/` | DOM HUD, adaptive glyphs, banners, title screen, pause/controls menus (CSS in `styles.css`) |
| `audio/` | Web Audio synthesis (no files): `AudioManager`, sound recipes, procedural ambience |
| `systems/` | `GameState` (gold, chests, shrines, respawn point; persisted in `localStorage`) |

### The harbour hub (`world/areas/harbor/`)

| Module | Builds |
| --- | --- |
| `HarborLayout` | every coordinate of the level (spawn, docks, ship, paths, shrine, chests, enemies, gate, crypt, fortress) |
| `HarborTerrain` | height, surface type and colour of the island, seabed, river and plateaus |
| `HarborDocks` | pier and gangplank walkable surfaces + their visuals and the quay wall |
| `HarborShips` | galleon (boardable), sloop at anchor, rowboats, beach wreck |
| `HarborRuins` | gate, stairs, crypt facade, plaza, columns, fortress, cobbled paths |
| `HarborDressing` | pirate occupation: cannons, cargo, camps with campfires, shacks, barricade |
| `HarborVegetation` | palms, jungle trees, understory, coral reef, rocks (instanced, density from the quality preset) |
| `HarborHub` | composes the modules, adds water, river, waterfall, sky life, regions and spawns |

## Key decisions

* **Kinematic 2.5D physics.** Characters are capsules on XZ that are snapped to the ground, where
  the ground is the terrain heightfield plus walkable platforms (docks, decks, ramps). The
  heightfield samples the exact triangles the terrain mesh renders. Steep slopes, drops over
  0.95 m and water deeper than 0.85 m block movement, so nobody falls off docks or cliffs.
* **Areas are data + builders.** `AreaDefinition.build()` returns terrain, physics, regions,
  enemy spawns and interactable spawns. A dungeon is a new `AreaDefinition` registered with the
  `WorldManager`. `SealedDoor` calls `Game.travelTo(areaId)`, which loads that area as soon as it
  exists.
* **Enemies are data.** New enemy types are new `EnemyDefinitions` entries (stats, appearance
  generator, attack choices, perception, behaviour) plus attack data in `AttackDefs`. Skeletons,
  island warriors and captains reuse the humanoid rig with new appearance presets.
* **Readable combat.** Attacks have wind-up, active and recovery phases with stamina costs and
  buffered inputs. Enemy wind-ups show a blade glint and play a sound. An attack-token
  coordinator lets only one pirate swing at a time.
* **Draw-call budget.** Static props are merged per material and spatial cell, vegetation is
  instanced, and each character uses two draw calls. A fixed set of lights avoids shader
  recompiles.
* **See-through dithering.** Tall geometry between the camera and the player is dithered out in
  the shader, so the camera never needs to clip through objects.

## Testing

* `npm test`: unit tests (physics, components, IK reachability of every attack clip, data sanity).
* `node scripts/playtest.mjs <scenario.json>`: drives the real game in headless Chromium through
  the debug API (`window.__game.debug`, available in dev or with `?debug`: `drive`, `advance`,
  `teleport`, `view`, `snapshot`, `press`, `setHealth`, `killEnemies`). It simulates the keyboard,
  mouse buttons and wheel, a fake gamepad (`navigator.getGamepads` stub) and multi-touch (CDP
  touch events). The simulation runs on a fixed step, so scenarios are deterministic.
* `node scripts/shot.mjs <url> <png>`: screenshots of the game or the asset viewer
  (`/viewer.html?asset=<name>`).
