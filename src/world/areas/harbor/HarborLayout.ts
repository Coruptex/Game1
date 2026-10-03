/**
 * Layout of the first hub: "Corsair's Rest".
 *
 * World axes: +X = east, -Z = north (jungle, gate, mountain, fortress), +Z = south (harbour, ocean).
 * Sea level is y = 0. All gameplay-relevant coordinates of the hub live here so terrain, props,
 * colliders, spawns and interactables stay consistent when the layout is tweaked.
 *
 *                       FORTRESS / MOUNTAIN   (z ~ -180 .. -260)
 *                              |
 *                        ANCIENT GATE         (z ~ -112)
 *                              |
 *                           JUNGLE            (z ~ -40 .. -100)
 *                              |
 *                         STONE PATH
 *                              |
 *         DUNGEON ------- HUB PLAZA ------- BEACH
 *        (x ~ -52)          (0, 0)         (x ~ 20..55)
 *                              |
 *                            DOCKS            (z ~ 20 .. 64)
 *                              |
 *                         PIRATE SHIP
 *                              |
 *                            OCEAN
 */

export interface PathPoint {
  x: number;
  z: number;
  /** Height of the path surface at this point. */
  h: number;
}

export interface PathDef {
  id: string;
  points: PathPoint[];
  /** Full width of the paved part (m). */
  width: number;
  /** Paved (cobblestones) or packed dirt. */
  paved: boolean;
}

export const HarborLayout = {
  seaLevel: 0,

  /** Terrain extents (m). */
  bounds: { minX: -170, maxX: 170, minZ: -280, maxZ: 170 },

  playerStart: { x: 4.2, z: 27, yaw: Math.PI },
  /** Default camera yaw for the first view (camera sits south-east looking north-west). */
  startCameraYaw: 0.62,

  plaza: { x: 0, z: 0, radius: 15, height: 2.4 },
  quay: { minX: -26, maxX: 13, minZ: 10.5, maxZ: 19.5, height: 1.75 },
  docks: {
    height: 1.75,
    main: { x: 4.2, z0: 19.5, z1: 66, halfWidth: 2.4 },
    west: { z: 44, x0: 1.8, x1: -19, halfWidth: 1.6 },
    westEnd: { x: -19, z0: 36, z1: 54, halfWidth: 1.6 },
    east: { z: 30, x0: 6.6, x1: 13.5, halfWidth: 1.4 },
  },
  ship: { x: 17.5, z: 50, yaw: 0, length: 30, beam: 8.6, deckHeight: 3.55 },
  gangplank: { x0: 6.6, x1: 13.2, z: 47, halfWidth: 0.85 },

  shrine: { x: -7.5, z: -4.5 },
  chests: [
    { id: 'chest_beach', x: 39.5, z: 9.5, yaw: -2.2, gold: 250 },
    { id: 'chest_jungle', x: 22.5, z: -65.5, yaw: 0.4, gold: 400 },
  ],
  dungeonDoor: { x: -53.2, z: -4, yaw: Math.PI / 2 },
  gate: { x: 0, z: -114, height: 9.5 },
  gateTerrace: { minX: -15, maxX: 15, minZ: -124, maxZ: -104.5, height: 9.5 },
  /** Backdrop fortress on the mountain shoulder; the plateau is an ellipse in its local frame. */
  fortress: { x: 40, z: -182, height: 46, yaw: -0.22, plateau: { halfX: 38, halfZ: 26 } },
  mountainPeak: { x: -30, z: -250, height: 112 },
  jungleCamp: { x: 18, z: -61 },
  monument: { x: -11, z: -70 },
  dungeonCourt: { minX: -55, maxX: -38, minZ: -12, maxZ: 3.5, height: 3.1 },
  jungleEdgeZ: -35,
  jungleHeight: 6.6,
  westCliffX: -38,
  seaStack: { x: 64, z: 82 },

  /** Jungle river: flows from the mountain foot to a waterfall over the plateau's east cliff. */
  river: {
    level: 5.65,
    bed: 4.95,
    halfWidth: 3.0,
    points: [
      [33.5, -112],
      [31, -96],
      [33, -80],
      [37, -65],
      [40.5, -51],
      [44.2, -43.2],
    ] as [number, number][],
    /** Waterfall: lip (top) and splash point in the sea. */
    fall: { x: 45.6, z: -41.6, toX: 48.6, toZ: -38.4 },
  },

  /** Enemy placements (type ids from enemies/EnemyDefinitions). */
  enemies: [
    { type: 'pirateSwordsman', x: 4.2, z: 50, yaw: Math.PI, patrol: [{ x: 4.4, z: 37 }, { x: 4.0, z: 61 }] },
    { type: 'pirateSwordsman', x: 33, z: 3.5, yaw: -1.3 },
    { type: 'pirateSwordsman', x: 37, z: -4, yaw: -2.2, patrol: [{ x: 36, z: -5 }, { x: 44, z: 1.5 }] },
    { type: 'pirateSwordsman', x: -2.5, z: -27, yaw: 0.1 },
    { type: 'pirateSwordsman', x: 15.5, z: -57.5, yaw: 2.6 },
    { type: 'pirateSwordsman', x: 21.5, z: -60.5, yaw: 3.0 },
    { type: 'pirateSwordsman', x: 1, z: -91.5, yaw: 0, patrol: [{ x: -2.5, z: -91.2 }, { x: 3.2, z: -91.6 }] },
    { type: 'pirateSwordsman', x: -41, z: -3, yaw: 1.4 },
  ],

  /** Island coastline (clockwise). Land is inside. */
  coast: [
    [13, 19.5],
    [20, 23.5],
    [31, 27.5],
    [43, 23],
    [52, 13],
    [56.5, -1],
    [55, -16],
    [50, -28],
    [45.5, -40],
    [47, -62],
    [49, -92],
    [46, -118],
    [70, -150],
    [150, -200],
    [170, -280],
    [-170, -280],
    [-150, -200],
    [-80, -150],
    [-61, -120],
    [-58, -86],
    [-60, -55],
    [-64, -30],
    [-66, -10],
    [-63, 7],
    [-55, 19],
    [-44, 24.5],
    [-33, 22],
    [-26, 19.5],
  ] as [number, number][],

  paths: [
    {
      id: 'north',
      paved: true,
      width: 3.6,
      points: [
        { x: 0, z: -9, h: 2.42 },
        { x: 0, z: -18, h: 2.6 },
        { x: -2, z: -27, h: 3.45 },
        { x: -3, z: -36, h: 5.0 },
        { x: -1, z: -44, h: 6.35 },
        { x: 3, z: -54, h: 6.6 },
        { x: 4, z: -64, h: 6.7 },
        { x: 1, z: -76, h: 6.8 },
        { x: -2, z: -88, h: 6.9 },
        { x: 0, z: -97, h: 7.0 },
        { x: 0, z: -104.5, h: 9.5 },
        { x: 0, z: -111, h: 9.5 },
      ],
    },
    {
      id: 'west',
      paved: true,
      width: 3.2,
      points: [
        { x: -7, z: -2, h: 2.42 },
        { x: -16, z: -3, h: 2.6 },
        { x: -26, z: -1.5, h: 2.8 },
        { x: -36, z: -3, h: 3.05 },
        { x: -47, z: -4, h: 3.1 },
      ],
    },
    {
      id: 'east',
      paved: true,
      width: 3,
      points: [
        { x: 7, z: 1.5, h: 2.4 },
        { x: 14, z: 3.5, h: 2.2 },
        { x: 21, z: 3, h: 1.85 },
      ],
    },
    {
      id: 'south',
      paved: true,
      width: 3.8,
      points: [
        { x: 2, z: 7, h: 2.36 },
        { x: 3.2, z: 12.5, h: 1.8 },
        { x: 4.2, z: 17, h: 1.75 },
      ],
    },
    {
      id: 'camp',
      paved: false,
      width: 2.4,
      points: [
        { x: 4, z: -62, h: 6.7 },
        { x: 11, z: -61.5, h: 6.7 },
        { x: 17, z: -61, h: 6.7 },
      ],
    },
    {
      id: 'monument',
      paved: false,
      width: 2.2,
      points: [
        { x: 1, z: -73, h: 6.8 },
        { x: -6, z: -72, h: 6.8 },
        { x: -10, z: -70.5, h: 6.8 },
      ],
    },
  ] as PathDef[],
};

export type HarborLayoutType = typeof HarborLayout;
