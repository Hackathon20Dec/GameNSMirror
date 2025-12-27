export type TerrainType = "WATER" | "SAND" | "GRASS" | "STONE";

export interface TerrainTile {
    type: TerrainType;
    frame: number; // spritesheet frame index
    solid: boolean;

    // Useful signals for gameplay + procedural placement
    elevation: number; // 0..1 (includes ridges/detail)
    moisture: number; // 0..1
    continent: number; // 0..1 (low-frequency landmass signal)

    // Hydrology
    isRiver: boolean;
    river01: number; // 0..1 proximity to river (0 = far, 1 = river core)

    // Biomes
    forest01: number; // 0..1 forest density potential
}

export type EntityType =
    | "CASTLE"
    | "HOUSE"
    | "OUTPOST"
    | "TREE"
    | "ROCK"
    | "PEBBLE"
    | "BUSH"
    | "MUSHROOM"
    | "BONE"
    | "RIVER_ROCK";

export type TileFrameIndex = number;
export type TileLayout = (TileFrameIndex | null)[][];

export interface EntityVariant {
    id: string;
    layout: TileLayout;
}

export interface EntityDefinition {
    type: EntityType;
    w: number;
    h: number;
    chance: number; // 0..1 (used mainly for nature; buildings are clustered now)
    allowedTerrain: TerrainType[];
    variants: EntityVariant[];
}

/**
 * Terrain frames (from user-provided sprite IDs)
 */
export const TERRAIN_FRAMES: Record<TerrainType, number> = {
    GRASS: 159,
    STONE: 169,
    SAND: 181,
    WATER: 187,
};

/**
 * Structure layouts (from user-provided sprite IDs)
 *
 * Notes:
 * - Layouts are tile-index grids (row-major) where `null` means "no tile" (transparent).
 * - Castle layout is 5x4 based on the provided IDs.
 */
const CASTLE_LAYOUT: TileLayout = [
    [58, 59, 60, 61, 62],
    [63, 64, 65, 66, 67],
    [68, 69, 70, 71, 72],
    [73, 74, 75, 76, 77],
];

const HOUSE_LAYOUT: TileLayout = [
    [78, 79],
    [80, 81],
    [82, 83],
];

const OUTPOST_LAYOUT: TileLayout = [
    [84, 85],
    [86, 87],
    [88, 89],
    [90, 91],
];

const TREE_LAYOUT_1: TileLayout = [
    [null, 46, null],
    [47, 48, 49],
    [55, 56, 57],
];

const TREE_LAYOUT_2: TileLayout = [
    [null, 106, 107],
    [47, 48, 49],
    [55, 56, 57],
];

const RIVER_ROCK_LAYOUT_1: TileLayout = [
    [121, 122],
    [123, 124],
];
const RIVER_ROCK_LAYOUT_2: TileLayout = [
    [125, 126],
    [127, 128],
];

const BUSH1_LAYOUT: TileLayout = [[24]];
const BUSH2_LAYOUT: TileLayout = [[25]];
const BUSH3_LAYOUT: TileLayout = [[26]];
const BUSH4_LAYOUT: TileLayout = [[27]];
const BUSH5_LAYOUT: TileLayout = [[28]];
const BUSH6_LAYOUT: TileLayout = [[29]];

const MUSHROOM1_LAYOUT: TileLayout = [[21]];
const MUSHROOM2_LAYOUT: TileLayout = [[22]];
const MUSHROOM3_LAYOUT: TileLayout = [[23]];

const ROCK_LAYOUT: TileLayout = [[144]];

const PEBBLE_LAYOUT_1: TileLayout = [[142]];
const PEBBLE_LAYOUT_2: TileLayout = [[143]];
const PEBBLE_LAYOUT_3: TileLayout = [[145]];

const BONE_LAYOUT_1: TileLayout = [[13]];
const BONE_LAYOUT_2: TileLayout = [[14]];
const BONE_LAYOUT_3: TileLayout = [[15]];

function assertRectLayout(
    type: string,
    layout: TileLayout,
    w: number,
    h: number
): void {
    if (layout.length !== h) {
        throw new Error(
            `Entity ${type} layout height ${layout.length} != expected ${h}`
        );
    }
    for (let y = 0; y < h; y++) {
        const row = layout[y];
        if (!row) throw new Error(`Entity ${type} layout missing row ${y}`);
        if (row.length !== w) {
            throw new Error(
                `Entity ${type} layout row ${y} width ${row.length} != expected ${w}`
            );
        }
    }
}

function makeEntity(def: EntityDefinition): EntityDefinition {
    for (const v of def.variants) {
        assertRectLayout(def.type, v.layout, def.w, def.h);
    }
    return def;
}

/**
 * Entity definitions.
 * Buildings are clustered/placed intentionally (villages/towns). Nature uses these as base tuning.
 */
export const ENTITIES: EntityDefinition[] = [
    makeEntity({
        type: "CASTLE",
        w: 5,
        h: 4,
        chance: 1, // not used as a random roll in the new settlement system
        allowedTerrain: ["GRASS", "STONE"],
        variants: [{ id: "castle", layout: CASTLE_LAYOUT }],
    }),
    makeEntity({
        type: "OUTPOST",
        w: 2,
        h: 4,
        chance: 1, // not used as a random roll in the new settlement system
        allowedTerrain: ["SAND", "STONE", "GRASS"],
        variants: [{ id: "outpost", layout: OUTPOST_LAYOUT }],
    }),
    makeEntity({
        type: "HOUSE",
        w: 2,
        h: 3,
        chance: 1, // not used as a random roll in the new settlement system
        allowedTerrain: ["GRASS", "STONE", "SAND"],
        variants: [{ id: "house", layout: HOUSE_LAYOUT }],
    }),
    makeEntity({
        type: "TREE",
        w: 3,
        h: 3,
        chance: 0.05,
        allowedTerrain: ["GRASS"],
        variants: [
            { id: "tree_1", layout: TREE_LAYOUT_1 },
            { id: "tree_2", layout: TREE_LAYOUT_2 },
        ],
    }),
    makeEntity({
        type: "ROCK",
        w: 1,
        h: 1,
        chance: 0.02,
        allowedTerrain: ["GRASS", "SAND", "STONE"],
        variants: [{ id: "rock", layout: ROCK_LAYOUT }],
    }),
    makeEntity({
        type: "PEBBLE",
        w: 1,
        h: 1,
        chance: 0.02,
        allowedTerrain: ["GRASS", "SAND", "STONE"],
        variants: [
            { id: "pebble_1", layout: PEBBLE_LAYOUT_1 },
            { id: "pebble_2", layout: PEBBLE_LAYOUT_2 },
            { id: "pebble_3", layout: PEBBLE_LAYOUT_3 },
        ],
    }),
    makeEntity({
        type: "BUSH",
        w: 1,
        h: 1,
        chance: 0.02,
        allowedTerrain: ["GRASS"],
        variants: [
            { id: "bush_1", layout: BUSH1_LAYOUT },
            { id: "bush_2", layout: BUSH2_LAYOUT },
            { id: "bush_3", layout: BUSH3_LAYOUT },
            { id: "bush_4", layout: BUSH4_LAYOUT },
            { id: "bush_5", layout: BUSH5_LAYOUT },
            { id: "bush_6", layout: BUSH6_LAYOUT },
        ],
    }),
    makeEntity({
        type: "MUSHROOM",
        w: 1,
        h: 1,
        chance: 0.01,
        allowedTerrain: ["STONE", "GRASS"],
        variants: [
            { id: "mushroom_1", layout: MUSHROOM1_LAYOUT },
            { id: "mushroom_2", layout: MUSHROOM2_LAYOUT },
            { id: "mushroom_3", layout: MUSHROOM3_LAYOUT },
        ],
    }),
    makeEntity({
        type: "BONE",
        w: 1,
        h: 1,
        chance: 0.01,
        allowedTerrain: ["GRASS", "SAND", "STONE"],
        variants: [
            { id: "bone_1", layout: BONE_LAYOUT_1 },
            { id: "bone_2", layout: BONE_LAYOUT_2 },
            { id: "bone_3", layout: BONE_LAYOUT_3 },
        ],
    }),
    makeEntity({
        type: "RIVER_ROCK",
        w: 2,
        h: 2,
        chance: 0.02,
        allowedTerrain: ["WATER"],
        variants: [
            { id: "river_rock_1", layout: RIVER_ROCK_LAYOUT_1 },
            { id: "river_rock_2", layout: RIVER_ROCK_LAYOUT_2 },
        ],
    }),
];

type Noise2D = (x: number, y: number) => number;

function clamp01(v: number): number {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

/**
 * Hash function used to turn a string into a deterministic 32-bit seed.
 * (xmur3 by @bryc, commonly used for seeded RNG setups)
 */
function xmur3(str: string): () => number {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}

function hashStringToUint32(str: string): number {
    const h = xmur3(str);
    return h();
}

function fmix32(h: number): number {
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
}

/**
 * Combine seed + coordinates + extra into a well-mixed uint32.
 * Works with negative coordinates (they get coerced into int32 during bitwise ops).
 */
function hashCoords(seed: number, x: number, y: number, extra: number): number {
    let h = seed | 0;

    h ^= x | 0;
    h = Math.imul(h, 0x9e3779b1);

    h ^= y | 0;
    h = Math.imul(h, 0x85ebca6b);

    h ^= extra | 0;
    h = Math.imul(h, 0xc2b2ae35);

    return fmix32(h);
}

function uint32ToUnitFloat(u: number): number {
    return (u >>> 0) / 4294967296;
}

/**
 * Small fast PRNG (mulberry32 by @bryc).
 * Produces floats in [0, 1).
 */
function _mulberry32(a: number): () => number {
    return () => {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// -----------------------------
// Seeded Simplex Noise 2D (in-file, no dependency)
// -----------------------------

class SeededRng {
    private state: number;
    constructor(seed: number) {
        this.state = seed >>> 0;
        if (this.state === 0) this.state = 0x12345678;
    }
    nextU32(): number {
        // xorshift32
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return this.state;
    }
    nextFloat01(): number {
        return uint32ToUnitFloat(this.nextU32());
    }
}

class SimplexNoise2D {
    private perm: Uint8Array;
    private permMod12: Uint8Array;

    constructor(seed: number) {
        const rng = new SeededRng(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;

        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rng.nextFloat01() * (i + 1));
            const tmp = p[i];
            p[i] = p[j];
            p[j] = tmp;
        }

        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    private static grad3: number[][] = [
        [1, 1, 0],
        [-1, 1, 0],
        [1, -1, 0],
        [-1, -1, 0],
        [1, 0, 1],
        [-1, 0, 1],
        [1, 0, -1],
        [-1, 0, -1],
        [0, 1, 1],
        [0, -1, 1],
        [0, 1, -1],
        [0, -1, -1],
    ];

    public noise2D(xin: number, yin: number): number {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;

        let n0 = 0;
        let n1 = 0;
        let n2 = 0;

        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        let i1 = 0;
        let j1 = 0;
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } else {
            i1 = 0;
            j1 = 1;
        }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;

        const gi0 = this.permMod12[ii + this.perm[jj]];
        const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            const g = SimplexNoise2D.grad3[gi0];
            n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            const g = SimplexNoise2D.grad3[gi1];
            n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            const g = SimplexNoise2D.grad3[gi2];
            n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
        }

        // Scale to roughly [-1, 1]
        return 70 * (n0 + n1 + n2);
    }
}

function createSeededNoise2D(seed: string): Noise2D {
    const inst = new SimplexNoise2D(hashStringToUint32(seed));
    return (x: number, y: number) => inst.noise2D(x, y);
}

export interface IslandConfig {
    enabled: boolean;
    centerX: number;      // Island center in tiles
    centerY: number;
    // Island dimensions - the shape is custom, not a simple ellipse
    topWidth: number;     // Width at the top (building area)
    bottomWidth: number;  // Width at the bottom (dock area)
    height: number;       // Total height of island
    beachWidth: number;   // Beach/sand width in tiles
    pathWidth: number;    // Dirt path width
    // Building locations (in tiles, relative to center)
    buildings: { type: 'CASTLE' | 'HOUSE' | 'OUTPOST'; x: number; y: number }[];
    // Dock location
    dockX: number;
    dockY: number;
}

export const DEFAULT_ISLAND_CONFIG: IslandConfig = {
    enabled: true,
    centerX: 0,
    centerY: 0,
    topWidth: 50,         // Wide at top for buildings
    bottomWidth: 12,      // Narrow at bottom for dock
    height: 40,           // Total height
    beachWidth: 3,
    pathWidth: 2,
    buildings: [
        { type: 'CASTLE', x: -18, y: -12 },   // Library (left) - larger building
        { type: 'HOUSE', x: 0, y: -12 },       // Cafe (center)
        { type: 'OUTPOST', x: 16, y: -12 },   // Gym (right)
    ],
    dockX: 0,
    dockY: 28,
};

export default class WorldGenerator {
    private readonly _seed: string;
    private readonly seedHash: number;

    // Island mode configuration
    private readonly islandConfig: IslandConfig;

    // ---- Noise fields (reworked worldgen) ----
    private readonly continentNoise: Noise2D;
    private readonly elevationDetailNoise: Noise2D;
    private readonly ridgeNoise: Noise2D;

    private readonly moistureNoise: Noise2D;
    private readonly forestPatchNoise: Noise2D;

    private readonly riverNoise: Noise2D;
    private readonly riverWarpNoiseX: Noise2D;
    private readonly riverWarpNoiseY: Noise2D;

    // Island edge noise for organic coastline
    private readonly coastlineNoise: Noise2D;

    // Large landmasses + large oceans
    private readonly continentScale = 0.006;
    private readonly seaLevel = 0.1;

    // Elevation detail (used for stone/highlands, not for ocean masking)
    private readonly elevationDetailScale = 0.03;
    private readonly ridgeScale = 0.02;

    // Biomes
    private readonly moistureScale = 0.01;
    private readonly forestScale = 0.012;

    // Rivers: noise "lines" + domain warp to make them meander
    private readonly riverScale = 0.01;
    private readonly riverWarpScale = 0.02;
    private readonly riverWarpAmpTiles = 18;

    // Pre-hash entity types so we don't redo string hashing inside tight loops.
    private readonly entityTypeHash: Record<EntityType, number>;

    constructor(seed: string, islandConfig: IslandConfig = DEFAULT_ISLAND_CONFIG) {
        this._seed = seed;
        this.seedHash = hashStringToUint32(seed);
        this.islandConfig = islandConfig;

        this.continentNoise = createSeededNoise2D(`${seed}::continent`);
        this.elevationDetailNoise = createSeededNoise2D(`${seed}::elev_detail`);
        this.ridgeNoise = createSeededNoise2D(`${seed}::ridges`);

        this.moistureNoise = createSeededNoise2D(`${seed}::moisture`);
        this.forestPatchNoise = createSeededNoise2D(`${seed}::forest_patch`);

        this.riverNoise = createSeededNoise2D(`${seed}::river`);
        this.riverWarpNoiseX = createSeededNoise2D(`${seed}::river_warp_x`);
        this.riverWarpNoiseY = createSeededNoise2D(`${seed}::river_warp_y`);

        this.coastlineNoise = createSeededNoise2D(`${seed}::coastline`);

        this.entityTypeHash = {
            CASTLE: hashStringToUint32("CASTLE"),
            HOUSE: hashStringToUint32("HOUSE"),
            OUTPOST: hashStringToUint32("OUTPOST"),
            TREE: hashStringToUint32("TREE"),
            ROCK: hashStringToUint32("ROCK"),
            PEBBLE: hashStringToUint32("PEBBLE"),
            BUSH: hashStringToUint32("BUSH"),
            MUSHROOM: hashStringToUint32("MUSHROOM"),
            BONE: hashStringToUint32("BONE"),
            RIVER_ROCK: hashStringToUint32("RIVER_ROCK"),
        };
    }

    /**
     * Get island distance factor (0 = center, 1 = edge, >1 = ocean)
     * Creates a custom shape: wide at top (buildings), narrow at bottom (dock)
     */
    private getIslandDistanceFactor(tileX: number, tileY: number): number {
        const cfg = this.islandConfig;
        const halfHeight = cfg.height / 2;

        // Relative position from center
        const relX = tileX - cfg.centerX;
        const relY = tileY - cfg.centerY;

        // Normalize Y position (-1 at top, +1 at bottom)
        const normalizedY = clamp01((relY + halfHeight) / cfg.height);

        // Width varies from topWidth at top to bottomWidth at bottom
        // Use a smooth curve for natural-looking shoreline
        const widthAtY = cfg.topWidth * (1 - normalizedY) + cfg.bottomWidth * normalizedY;
        const halfWidthAtY = widthAtY / 2;

        // Calculate horizontal distance factor
        const horizDist = Math.abs(relX) / halfWidthAtY;

        // Calculate vertical distance factor
        const vertDist = Math.abs(relY) / halfHeight;

        // Combine into overall distance (inside island = < 1)
        // Use smooth blend that respects the tapering shape
        let dist: number;

        if (relY < -halfHeight || relY > halfHeight) {
            // Above or below the island
            dist = 1.5;
        } else if (Math.abs(relX) > halfWidthAtY) {
            // Outside horizontal bounds at this Y level
            dist = horizDist;
        } else {
            // Inside the island shape - use max of normalized distances
            dist = Math.max(horizDist * 0.9, vertDist * 0.85);
        }

        // Add organic noise to coastline for natural look
        const angle = Math.atan2(relY, relX);
        const coastNoise = this.coastlineNoise(
            Math.cos(angle) * 3 + tileX * 0.05,
            Math.sin(angle) * 3 + tileY * 0.05
        ) * 0.12;

        dist += coastNoise;

        return dist;
    }

    /**
     * Check if tile is on a dirt path connecting buildings
     * Creates T-shaped path: horizontal connecting buildings, vertical down to dock
     */
    private isOnPath(tileX: number, tileY: number): boolean {
        const cfg = this.islandConfig;
        const pathHalf = cfg.pathWidth;

        // Building row Y position (in front of buildings)
        const buildingY = cfg.buildings[0]?.y ?? -12;
        const pathY = cfg.centerY + buildingY + 5; // Path slightly in front of buildings

        // Get leftmost and rightmost building positions
        const leftmost = Math.min(...cfg.buildings.map(b => b.x)) - 3;
        const rightmost = Math.max(...cfg.buildings.map(b => b.x)) + 4;

        // HORIZONTAL PATH: Connecting all three buildings
        if (tileY >= pathY - pathHalf && tileY <= pathY + pathHalf) {
            if (tileX >= cfg.centerX + leftmost && tileX <= cfg.centerX + rightmost) {
                return true;
            }
        }

        // VERTICAL PATH: From horizontal path down to dock
        const dockPathX = cfg.centerX + cfg.dockX;
        if (tileX >= dockPathX - pathHalf && tileX <= dockPathX + pathHalf) {
            if (tileY >= pathY && tileY <= cfg.centerY + cfg.dockY + 2) {
                return true;
            }
        }

        // Small paths connecting each building to horizontal path
        for (const building of cfg.buildings) {
            const bx = cfg.centerX + building.x;
            const by = cfg.centerY + building.y;
            // Vertical connection from building to main path
            if (tileX >= bx - 1 && tileX <= bx + 1) {
                if (tileY >= by + 3 && tileY <= pathY + pathHalf) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Deterministic random float for any integer coordinate space (tile coords, chunk coords, etc.)
     * Returns a float in [0, 1).
     */
    public randomAtPoint(ix: number, iy: number, salt: string): number {
        const extra = hashStringToUint32(salt);
        const h = hashCoords(this.seedHash, ix, iy, extra);
        return uint32ToUnitFloat(h);
    }

    public getTerrainAtTile(tileX: number, tileY: number): TerrainTile {
        // --- ISLAND MODE ---
        if (this.islandConfig.enabled) {
            return this.getIslandTerrainAtTile(tileX, tileY);
        }

        // --- ORIGINAL INFINITE WORLD MODE ---
        // Continents / oceans (low frequency)
        // We shape the continent value slightly so we get bigger swathes of ocean/land and fewer noisy coastlines.
        const c0 =
            (this.continentNoise(
                tileX * this.continentScale,
                tileY * this.continentScale
            ) +
                1) /
            2;
        const continent = smoothstep(0.12, 0.88, c0);

        const isOcean = continent < this.seaLevel;

        // --- Elevation (used for mountains/stone, not for deciding oceans) ---
        const d =
            (this.elevationDetailNoise(
                tileX * this.elevationDetailScale,
                tileY * this.elevationDetailScale
            ) +
                1) /
            2;
        const ridgeRaw = this.ridgeNoise(
            tileX * this.ridgeScale,
            tileY * this.ridgeScale
        );
        const ridges = 1 - Math.abs(ridgeRaw); // 0..1

        // Keep elevation mostly driven by continent (big features), with some detail.
        let elevation = clamp01(continent * 0.85 + d * 0.15);

        // Add ridges for mountain chains without creating lakes.
        elevation = clamp01(elevation + (ridges - 0.55) * 0.22);

        // --- Moisture + forest patches (biomes) ---
        const m0 =
            (this.moistureNoise(
                tileX * this.moistureScale,
                tileY * this.moistureScale
            ) +
                1) /
            2;
        const moisture = clamp01(m0);

        // --- Rivers (only on land) ---
        // Previous approach sampled the river field only at the tile center, which can look "dotted"
        // when the river centerline passes between integer tile centers. To fix this, we supersample
        // inside the tile and take the minimum |noise| (proxy for distance to the centerline).
        let isRiver = false;
        let river01 = 0;

        if (!isOcean) {
            const samples: Array<[number, number]> = [
                [0.5, 0.5],
                [0.2, 0.2],
                [0.8, 0.2],
                [0.2, 0.8],
                [0.8, 0.8],
            ];

            let minAbs = 999;

            for (const [ox, oy] of samples) {
                const sx = tileX + ox;
                const sy = tileY + oy;

                const warpX =
                    this.riverWarpNoiseX(
                        sx * this.riverWarpScale,
                        sy * this.riverWarpScale
                    ) * this.riverWarpAmpTiles;
                const warpY =
                    this.riverWarpNoiseY(
                        sx * this.riverWarpScale,
                        sy * this.riverWarpScale
                    ) * this.riverWarpAmpTiles;

                const rn = this.riverNoise(
                    (sx + warpX) * this.riverScale,
                    (sy + warpY) * this.riverScale
                );
                const a = Math.abs(rn);
                if (a < minAbs) minAbs = a;
            }

            // Slightly wider in lowlands, but keep it around ~2–3 tiles in most places.
            const lowland = clamp01(1 - elevation);

            // These thresholds are in "noise value" space. With riverScale=0.01, this tends to land
            // in the ~2–3 tiles wide range after supersampling.
            const coreWidth = this.riverScale * (1.45 + lowland * 0.35) * 5; // ~0.0145..0.0180
            const proxWidth = coreWidth * 3.5;

            isRiver = minAbs < coreWidth;
            river01 = clamp01((proxWidth - minAbs) / proxWidth);
        }

        // --- Terrain resolution ---
        let type: TerrainType;

        if (isOcean || isRiver) {
            type = "WATER";
        } else {
            const isStone = elevation > 0.82 || (ridges > 0.88 && elevation > 0.72);

            if (isStone) {
                type = "STONE";
            } else {
                // Beaches near the sea + occasional desert patches.
                const coast01 = clamp01(1 - (continent - this.seaLevel) / 0.07); // 1 near coast, 0 inland
                const desert01 = clamp01((0.33 - moisture) / 0.33);

                // Optional river banks: keep it subtle so villages can still sit near rivers.
                // Only the immediate river edge turns sandy.
                const riverBank01 = clamp01((river01 - 0.93) / 0.07);

                const sandScore = Math.max(
                    coast01 * 0.85,
                    desert01 * 0.9,
                    riverBank01 * 0.55
                );
                type = sandScore > 0.62 ? "SAND" : "GRASS";
            }
        }

        const frame = TERRAIN_FRAMES[type];
        // Water (oceans + rivers) blocks movement/placement.
        const solid = type === "WATER";

        // --- Forest density signal ---
        // Forests happen on GRASS: need moisture + patch noise. Rivers boost forest nearby.
        let forest01 = 0;
        if (type === "GRASS") {
            const patch =
                (this.forestPatchNoise(
                    tileX * this.forestScale,
                    tileY * this.forestScale
                ) +
                    1) /
                2;
            const patch01 = smoothstep(0.42, 0.9, patch);
            const moist01 = smoothstep(0.48, 0.9, moisture);

            // Rivers increase lushness a bit, but you still need forest patches for true thick forests.
            const riverBoost = river01 * 0.22;

            forest01 = clamp01(moist01 * patch01 + riverBoost);
        }

        return {
            type,
            frame,
            solid,
            elevation,
            moisture,
            continent,
            isRiver,
            river01,
            forest01,
        };
    }

    public isSolidAtTile(tileX: number, tileY: number): boolean {
        return this.getTerrainAtTile(tileX, tileY).solid;
    }

    /**
     * Deterministic per-tile RNG for entity placement checks.
     * Returns a float in [0, 1).
     */
    public randomForEntityAtTile(
        tileX: number,
        tileY: number,
        entityType: EntityType
    ): number {
        const extra = this.entityTypeHash[entityType] ?? 0;
        const h = hashCoords(this.seedHash, tileX, tileY, extra);
        return uint32ToUnitFloat(h);
    }

    /**
     * Deterministic per-tile RNG with an arbitrary salt (string).
     * Returns a float in [0, 1).
     *
     * Use this when you need another random value that should NOT be coupled
     * to the entity chance roll.
     */
    public randomAtTile(tileX: number, tileY: number, salt: string): number {
        const extra = hashStringToUint32(salt);
        const h = hashCoords(this.seedHash, tileX, tileY, extra);
        return uint32ToUnitFloat(h);
    }

    /**
     * Island mode terrain generation - creates a bounded island with:
     * - Water surrounding the island
     * - Sandy beaches along the edge
     * - Grass interior with trees
     * - Dirt paths connecting buildings
     */
    private getIslandTerrainAtTile(tileX: number, tileY: number): TerrainTile {
        const cfg = this.islandConfig;
        const distFactor = this.getIslandDistanceFactor(tileX, tileY);

        // Beach zone thresholds (based on distance factor)
        const beachStart = 0.75;  // Beach starts at 75% towards edge
        const oceanStart = 0.95;  // Water starts at 95%

        let type: TerrainType;
        let isRiver = false;
        let river01 = 0;

        // Check if on path (dirt/sand colored)
        const onPath = this.isOnPath(tileX, tileY);

        // Check if near dock area (bottom of island)
        const nearDock = Math.abs(tileX - cfg.centerX - cfg.dockX) < 4 &&
                         tileY > cfg.centerY + cfg.dockY - 3 &&
                         tileY < cfg.centerY + cfg.dockY + 5;

        if (distFactor >= oceanStart && !nearDock) {
            // Ocean - water surrounding island
            type = "WATER";
        } else if (nearDock && distFactor >= oceanStart) {
            // Dock area extends slightly into water as sand/pier
            type = "SAND";
        } else if (distFactor >= beachStart || onPath) {
            // Beach zone or dirt path
            type = "SAND";
        } else {
            // Interior - mostly grass
            // Add some variation with elevation noise
            const elevNoise = (this.elevationDetailNoise(
                tileX * this.elevationDetailScale,
                tileY * this.elevationDetailScale
            ) + 1) / 2;

            // Small stone patches (rocks) scattered on grass
            if (elevNoise > 0.88 && distFactor < 0.5) {
                type = "STONE";
            } else {
                type = "GRASS";
            }
        }

        const frame = TERRAIN_FRAMES[type];
        const solid = type === "WATER";

        // Elevation based on distance from center (higher in middle)
        const elevation = clamp01(1 - distFactor);

        // Moisture - higher near water/beach
        const moisture = clamp01(distFactor > beachStart ? 0.8 : 0.5 + (1 - distFactor) * 0.3);

        // Continent value (for compatibility)
        const continent = distFactor < oceanStart ? 0.8 : 0;

        // Forest density - grass areas away from paths and buildings
        let forest01 = 0;
        if (type === "GRASS" && !onPath) {
            const patch = (this.forestPatchNoise(
                tileX * this.forestScale,
                tileY * this.forestScale
            ) + 1) / 2;

            // Less trees near buildings
            const nearBuilding = cfg.buildings.some(b => {
                const bx = cfg.centerX + b.x;
                const by = cfg.centerY + b.y;
                const dist = Math.sqrt((tileX - bx) ** 2 + (tileY - by) ** 2);
                return dist < 10;
            });

            // Less trees near path
            if (!nearBuilding && !onPath) {
                forest01 = clamp01(patch * 0.6);
            }
        }

        return {
            type,
            frame,
            solid,
            elevation,
            moisture,
            continent,
            isRiver,
            river01,
            forest01,
        };
    }
}