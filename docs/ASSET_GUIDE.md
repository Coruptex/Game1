# Procedural Asset Authoring Guide

All art in *Ember of Retribution* is generated in code (no external models/textures).
This guide is the contract every environment asset follows.

## Art direction (north star)

The three reference images define the look: an **illustrated, colourful, atmospheric pirate
adventure** — NOT photorealistic, NOT generic low-poly, NOT grey-box.

- Stylised, slightly exaggerated proportions, chunky readable silhouettes (seen from an elevated
  isometric camera 15–30 m away — tiny details are invisible, silhouettes and colour blocks matter).
- Weathered warm-brown wood (docks, ships, crates), moss-covered greenish-beige ancient stone,
  saturated tropical greens, turquoise water, accents of red (flags, sashes, flowers), orange
  bromeliads, purple orchids, gold treasure.
- Hand-crafted feel: nothing perfectly straight or uniform. Jitter vertices slightly, vary scale
  and rotation, vary colours per piece (`jitterColors`), darken bases (`bakeGroundAO`).
- Avoid flat single-colour boxes; break shapes up (planks instead of slabs, bevelled/rounded
  forms, chipped stone, broken edges).

## Coordinate conventions

- Metres, +Y up, ground contact at y = 0 in prop-local space. Props face +Z unless documented.
- Player character: ~1.85 m tall, collision radius 0.45 m. Doors ≥ 2.4 m, walkable openings ≥ 1.6 m.
- Sea level is y = 0. Dock decks are 1.75 m above sea level.

## The contract (`src/environment/PropTypes.ts`)

- `PropDefinition` = `{ name, parts: PropPart[], colliders?, platforms? }` for static props. Parts are
  merged into large batches by `StaticBatcher`, so returning many small parts is fine.
- `PropPart.material` is a `MaterialName` from `src/assets/materials/MaterialLibrary.ts`. Set
  `seeThrough: true` on tall parts that could hide the player (walls, sails, hulls, canopies) — they get
  dithered out between camera and player.
- `colliders`: circles / oriented boxes (prop-local) with `yMin/yMax`. Keep them simple and slightly
  smaller than the visuals. Things lower than 0.3 m are stepped over.
- `platforms`: walkable surfaces (decks, floors, stair ramps). `height` = top surface at the centre,
  `slope` = rise per metre along local +Z (stairs are ramps), `thickness` = solid depth below.
  Characters can step up 0.55 m and never walk off drops > 0.95 m.
- `InstancedAsset` for things placed many times (vegetation, coral, rocks, cobblestones): keep
  triangle counts low (palms < 1500 tris, ferns < 300, flowers < 150, cobblestones < 40).

## Materials & colour

Use `MaterialLibrary` names only (never `new THREE.Material` inside asset builders).

- **Textured materials** (`wood`, `woodPlanks`, `woodDark`, `woodPale`, `stoneBlocks`, `stone`, `rock`,
  `palmBark`, `jungleBark`, `thatch`, `sail`, `palmLeaf`, `fern`, `broadLeaf`, `canopy*`, `grass`):
  vertex colours MULTIPLY the texture → keep vertex colours near white (`0xffffff`) and only tint
  subtly (e.g. `0xe8dccb` for slightly darker wood, `0xdfe8c8` for mossy stone).
- **Untextured materials** (`vertexColor`, `metal`, `gold`, `brass`, `rope`, `flower`, `coral`, `cloth`):
  vertex colours are the actual colour — use `Palette` values (with variation).
- Colours are converted to linear space by three.js; pick from `Palette` / sRGB hex as usual.
- UVs matter for textured materials: map wood grain along the length of planks/posts, stone blocks
  so blocks are ~0.5–0.8 m (`stoneBlocks` texture tile = 6 rows of blocks).

## Geometry helpers (`src/assets/geometry/GeometryUtils.ts`)

`paint`, `paintGradientY`, `bakeGroundAO`, `jitterColors`, `displace`, `sphericalNormals`, `flatShaded`,
`place` (clone + TRS), `trs`, `merge`, `cylinderBetween`, `ropeBetween`, `rockGeometry`.
Every geometry must end with position/normal/uv/color (`ensureStandardAttributes` is applied by the
batcher, but call `paint` to set real colours).

## Verifying assets

1. Create `src/environment/<area>/<Name>.assets.ts` exporting `export const assets: AssetCatalog`.
   The dev viewer discovers it automatically (see `src/tools/examples.assets.ts`).
2. With the dev server running (`npm run dev`, port 5173):
   `http://localhost:5173/viewer.html?asset=<name>&dist=14&yaw=0.7&pitch=0.42&ty=1`
   Options: `water=1` (sea plane at y=0, ground at -0.6), `deep=1`, `ground=sand|grass|stone|jungle`,
   `colliders=1` (red = colliders, green = platforms), `atmo=jungle`, `spin=1`.
3. Headless screenshot: `node scripts/shot.mjs "<viewer url>" screenshots/<name>.png`
   (software rendering: ~20 s per shot; the on-screen text shows build time and triangle count).
4. `npx tsc --noEmit` must pass for your files.
