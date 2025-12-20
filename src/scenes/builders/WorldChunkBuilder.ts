import Phaser from "phaser";
import {
    CHUNK_SIZE_TILES,
    HALF_CHUNK_SIZE_TILES,
    SPRITESHEET_FRAME_SIZE,
    SPRITESHEET_SCALE,
    TILE_SIZE,
} from "../../constants";
import WorldGenerator, {
    ENTITIES,
    EntityDefinition,
    EntityVariant,
    TerrainType,
    TileLayout,
} from "../../world/WorldGenerator";
import UnitStripManager from "../systems/UnitStripManager";

interface LocalPoint {
    x: number;
    y: number;
}

interface SettlementInfo {
    center: LocalPoint;
    housesPlaced: number;
    hasOutpost: boolean;
    hasCastle: boolean;
    riverBias: number;
}

export interface NpcIdleVariant {
    id: string;
    textureKey: string;
    animKey: string;
}

export interface WorldChunkBuilderOptions {
    scene: Phaser.Scene;
    generator: WorldGenerator;
    worldTextureKey: string;
    unitStrips: UnitStripManager;
    npcIdleVariants?: NpcIdleVariant[];
}

export default class WorldChunkBuilder {
    private readonly scene: Phaser.Scene;
    private readonly generator: WorldGenerator;
    private readonly worldTextureKey: string;
    private readonly unitStrips: UnitStripManager;

    private npcIdleVariants: NpcIdleVariant[] = [];

    // Def cache
    private defCache = new Map<EntityDefinition["type"], EntityDefinition>();

    constructor(opts: WorldChunkBuilderOptions) {
        this.scene = opts.scene;
        this.generator = opts.generator;
        this.worldTextureKey = opts.worldTextureKey;
        this.unitStrips = opts.unitStrips;
        this.npcIdleVariants = opts.npcIdleVariants ?? [];
    }

    public setNpcIdleVariants(list: NpcIdleVariant[]): void {
        this.npcIdleVariants = list ?? [];
    }

    private chunkToTileOrigin(
        cx: number,
        cy: number
    ): { tileX: number; tileY: number } {
        return {
            tileX: cx * CHUNK_SIZE_TILES - HALF_CHUNK_SIZE_TILES,
            tileY: cy * CHUNK_SIZE_TILES - HALF_CHUNK_SIZE_TILES,
        };
    }

    // -----------------------------
    // Entity helpers
    // -----------------------------

    private getDef(type: EntityDefinition["type"]): EntityDefinition {
        const cached = this.defCache.get(type);
        if (cached) return cached;

        const def = ENTITIES.find((d) => d.type === type);
        if (!def) throw new Error(`Missing entity definition for type: ${type}`);

        this.defCache.set(type, def);
        return def;
    }

    private makeBoolGrid(fill = false): boolean[][] {
        const g: boolean[][] = [];
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            g[y] = [];
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) g[y][x] = fill;
        }
        return g;
    }

    private cloneBoolGrid(src: boolean[][]): boolean[][] {
        const g: boolean[][] = [];
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            g[y] = [];
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) g[y][x] = !!src[y]?.[x];
        }
        return g;
    }

    private pickVariant(
        def: EntityDefinition,
        worldTileX: number,
        worldTileY: number
    ): EntityVariant {
        const variants = def.variants ?? [];
        if (variants.length === 0) return { id: "missing", layout: [[null]] };

        const roll = this.generator.randomAtTile(
            worldTileX,
            worldTileY,
            `variant::${def.type}`
        );
        const idx = Math.floor(roll * variants.length) % variants.length;
        return variants[idx] ?? variants[0];
    }

    private canPlaceWithLayout(
        localX: number,
        localY: number,
        def: EntityDefinition,
        layout: TileLayout,
        occupied: boolean[][],
        placeable: boolean[][],
        terrainTypes: TerrainType[][],
        ignorePlaceable = false
    ): boolean {
        const h = layout.length;
        const w = layout[0]?.length ?? 0;

        if (w <= 0 || h <= 0) return false;

        if (localX < 0 || localY < 0) return false;
        if (localX + w > CHUNK_SIZE_TILES) return false;
        if (localY + h > CHUNK_SIZE_TILES) return false;

        for (let oy = 0; oy < h; oy++) {
            const row = layout[oy];
            if (!row) continue;

            for (let ox = 0; ox < w; ox++) {
                const frame = row[ox];
                if (frame === null || frame === undefined) continue; // transparent cell does not occupy space

                const x = localX + ox;
                const y = localY + oy;

                if (occupied[y][x]) return false;
                if (!ignorePlaceable && !placeable[y][x]) return false;

                const terrain = terrainTypes[y][x];
                if (!def.allowedTerrain.includes(terrain)) return false;
            }
        }

        return true;
    }

    private markOccupiedWithLayout(
        localX: number,
        localY: number,
        layout: TileLayout,
        occupied: boolean[][]
    ): void {
        for (let oy = 0; oy < layout.length; oy++) {
            const row = layout[oy];
            if (!row) continue;

            for (let ox = 0; ox < row.length; ox++) {
                const frame = row[ox];
                if (frame === null || frame === undefined) continue;

                const x = localX + ox;
                const y = localY + oy;

                if (y >= 0 && y < CHUNK_SIZE_TILES && x >= 0 && x < CHUNK_SIZE_TILES) {
                    occupied[y][x] = true;
                }
            }
        }
    }

    private paintLayout(
        layer: Phaser.Tilemaps.TilemapLayer,
        localX: number,
        localY: number,
        layout: TileLayout
    ): void {
        for (let oy = 0; oy < layout.length; oy++) {
            const row = layout[oy];
            if (!row) continue;

            for (let ox = 0; ox < row.length; ox++) {
                const frame = row[ox];
                if (frame === null || frame === undefined) continue;
                layer.putTileAt(frame, localX + ox, localY + oy, false);
            }
        }
    }

    // -----------------------------
    // Chunk Generation (Terrain + Settlements + Nature + NPCs)
    // -----------------------------

    public buildChunkObjects(
        cx: number,
        cy: number
    ): Phaser.GameObjects.GameObject[] {
        const objects: Phaser.GameObjects.GameObject[] = [];
        const origin = this.chunkToTileOrigin(cx, cy);

        const originPx = origin.tileX * TILE_SIZE;
        const originPy = origin.tileY * TILE_SIZE;

        // Tilemap uses source tile size (64) then scaled down to TILE_SIZE (32).
        const map = this.scene.make.tilemap({
            tileWidth: SPRITESHEET_FRAME_SIZE,
            tileHeight: SPRITESHEET_FRAME_SIZE,
            width: CHUNK_SIZE_TILES,
            height: CHUNK_SIZE_TILES,
        });

        const tileset = map.addTilesetImage(
            "tiles",
            this.worldTextureKey,
            SPRITESHEET_FRAME_SIZE,
            SPRITESHEET_FRAME_SIZE
        );
        if (!tileset) {
            map.destroy();
            return objects;
        }

        const terrainLayer = map.createBlankLayer(
            `terrain_${cx}_${cy}`,
            tileset,
            originPx,
            originPy
        );
        const entityLayer = map.createBlankLayer(
            `entities_${cx}_${cy}`,
            tileset,
            originPx,
            originPy
        );

        if (!terrainLayer || !entityLayer) {
            terrainLayer?.destroy();
            entityLayer?.destroy();
            map.destroy();
            return objects;
        }

        terrainLayer.setDepth(0);
        entityLayer.setDepth(1);

        terrainLayer.setScale(SPRITESHEET_SCALE);
        entityLayer.setScale(SPRITESHEET_SCALE);

        objects.push(terrainLayer);
        objects.push(entityLayer);

        // Precompute tile signals for this chunk
        const placeable: boolean[][] = [];
        const terrainTypes: TerrainType[][] = [];
        const river01: number[][] = [];
        const forest01: number[][] = [];

        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            placeable[y] = [];
            terrainTypes[y] = [];
            river01[y] = [];
            forest01[y] = [];

            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const t = this.generator.getTerrainAtTile(worldTileX, worldTileY);

                terrainLayer.putTileAt(t.frame, x, y, false);

                placeable[y][x] = !t.solid;
                terrainTypes[y][x] = t.type;
                river01[y][x] = t.river01;
                forest01[y][x] = t.forest01;
            }
        }

        // --- Phase 1: Settlements (buildings clustered; buildings override nature by being placed first) ---
        const buildingOcc = this.makeBoolGrid(false);
        const settlement = this.placeSettlementForChunk(
            cx,
            cy,
            origin,
            entityLayer,
            buildingOcc,
            placeable,
            terrainTypes,
            river01
        );

        // --- Phase 2: Nature (trees/rocks/pebbles/bushes/mushrooms/bones/river rocks) ---
        const occupied = this.cloneBoolGrid(buildingOcc);
        this.placeNature(
            origin,
            entityLayer,
            occupied,
            placeable,
            terrainTypes,
            river01,
            forest01
        );

        // --- Phase 3: NPCs (sprites, idle only) ---
        this.placeNpcs(
            cx,
            cy,
            origin,
            occupied,
            placeable,
            terrainTypes,
            settlement,
            objects
        );

        return objects;
    }

    // -----------------------------
    // Settlements
    // -----------------------------

    private pickBestSettlementCenter(
        cx: number,
        cy: number,
        placeable: boolean[][],
        river01: number[][]
    ): { p: LocalPoint | null; riverBias: number } {
        // Sample deterministic candidate centers and choose the best (biased toward rivers).
        const samples = 14;

        let best: LocalPoint | null = null;
        let bestScore = -1;

        for (let i = 0; i < samples; i++) {
            const rx = this.generator.randomAtPoint(cx, cy, `settle_center_x_${i}`);
            const ry = this.generator.randomAtPoint(cx, cy, `settle_center_y_${i}`);

            const x = Math.floor(rx * CHUNK_SIZE_TILES);
            const y = Math.floor(ry * CHUNK_SIZE_TILES);

            if (x < 0 || y < 0 || x >= CHUNK_SIZE_TILES || y >= CHUNK_SIZE_TILES)
                continue;
            if (!placeable[y][x]) continue;

            const score = river01[y][x];

            // Small deterministic jitter so ties don't always choose the first sample.
            const jitter =
                this.generator.randomAtPoint(cx, cy, `settle_center_jitter_${i}`) *
                0.02;

            if (score + jitter > bestScore) {
                bestScore = score + jitter;
                best = { x, y };
            }
        }

        return { p: best, riverBias: best ? river01[best.y][best.x] : 0 };
    }

    private placeSettlementForChunk(
        cx: number,
        cy: number,
        origin: { tileX: number; tileY: number },
        entityLayer: Phaser.Tilemaps.TilemapLayer,
        buildingOcc: boolean[][],
        placeable: boolean[][],
        terrainTypes: TerrainType[][],
        river01: number[][]
    ): SettlementInfo | null {
        const { p: center, riverBias } = this.pickBestSettlementCenter(
            cx,
            cy,
            placeable,
            river01
        );
        if (!center) return null;

        // ---- Increased spawn rates to make villages/towns more common ----
        const baseChance = 0.16; // was 0.05
        const riverBonus = 0.32 * riverBias; // was 0.18 * riverBias
        let spawnChance = Phaser.Math.Clamp(baseChance + riverBonus, 0, 0.65);

        // Ensure early visibility around the starting area
        const nearSpawn = Math.abs(cx) <= 1 && Math.abs(cy) <= 1;
        if (nearSpawn) spawnChance = Math.max(spawnChance, 0.8);

        const spawnRoll = this.generator.randomAtPoint(cx, cy, "settlement_spawn");
        if (spawnRoll >= spawnChance) return null;

        // Slightly bigger settlements on average (still biased toward smaller clusters).
        const sizeRoll = this.generator.randomAtPoint(
            cx,
            cy,
            "settlement_house_count"
        );
        const houseTarget = 2 + Math.floor(Math.pow(sizeRoll, 1.6) * 26); // was 1..20

        // Cluster radius scales with house count (clamped to fit the chunk)
        const radius = Math.min(14, 4 + Math.ceil(houseTarget * 0.5));

        const houseDef = this.getDef("HOUSE");

        let housesPlaced = 0;
        let attempts = 0;
        const maxAttempts = houseTarget * 45;

        while (housesPlaced < houseTarget && attempts < maxAttempts) {
            const rA = this.generator.randomAtPoint(
                cx,
                cy,
                `house_angle_${attempts}`
            );
            const rD = this.generator.randomAtPoint(cx, cy, `house_dist_${attempts}`);

            const angle = rA * Math.PI * 2;
            const dist = Math.pow(rD, 1.8) * radius; // bias toward center

            const px = Math.round(center.x + Math.cos(angle) * dist);
            const py = Math.round(center.y + Math.sin(angle) * dist);

            // Center the footprint a bit around the sampled point
            const localX = px - Math.floor(houseDef.w / 2);
            const localY = py - Math.floor(houseDef.h / 2);

            const worldTileX = origin.tileX + localX;
            const worldTileY = origin.tileY + localY;

            const variant = this.pickVariant(houseDef, worldTileX, worldTileY);

            if (
                this.canPlaceWithLayout(
                    localX,
                    localY,
                    houseDef,
                    variant.layout,
                    buildingOcc,
                    placeable,
                    terrainTypes
                )
            ) {
                this.paintLayout(entityLayer, localX, localY, variant.layout);
                this.markOccupiedWithLayout(
                    localX,
                    localY,
                    variant.layout,
                    buildingOcc
                );
                housesPlaced++;
            }

            attempts++;
        }

        if (housesPlaced <= 0) return null;

        let hasOutpost = false;
        let hasCastle = false;

        // Village rule: if >=6 houses, chance to place an outpost.
        const placedEnoughForOutpost = housesPlaced >= 6;
        if (placedEnoughForOutpost) {
            const outpostDef = this.getDef("OUTPOST");
            const outpostChance = Math.min(0.92, 0.28 + 0.62 * riverBias);
            const outpostRoll = this.generator.randomAtPoint(
                cx,
                cy,
                "settlement_outpost_roll"
            );

            if (outpostRoll < outpostChance) {
                hasOutpost = this.tryPlaceSpecialBuilding(
                    cx,
                    cy,
                    origin,
                    entityLayer,
                    buildingOcc,
                    placeable,
                    terrainTypes,
                    river01,
                    outpostDef,
                    center,
                    radius + 4,
                    "outpost"
                );
            }
        }

        // Town rule: if >=11 houses, chance to place a castle.
        const placedEnoughForCastle = housesPlaced >= 11;
        if (placedEnoughForCastle) {
            const castleDef = this.getDef("CASTLE");
            const castleChance = Math.min(0.82, 0.18 + 0.46 * riverBias);
            const castleRoll = this.generator.randomAtPoint(
                cx,
                cy,
                "settlement_castle_roll"
            );

            if (castleRoll < castleChance) {
                hasCastle = this.tryPlaceSpecialBuilding(
                    cx,
                    cy,
                    origin,
                    entityLayer,
                    buildingOcc,
                    placeable,
                    terrainTypes,
                    river01,
                    castleDef,
                    center,
                    radius + 6,
                    "castle"
                );
            }
        }

        return {
            center,
            housesPlaced,
            hasOutpost,
            hasCastle,
            riverBias,
        };
    }

    private tryPlaceSpecialBuilding(
        cx: number,
        cy: number,
        origin: { tileX: number; tileY: number },
        entityLayer: Phaser.Tilemaps.TilemapLayer,
        buildingOcc: boolean[][],
        placeable: boolean[][],
        terrainTypes: TerrainType[][],
        river01: number[][],
        def: EntityDefinition,
        center: LocalPoint,
        maxRadius: number,
        saltPrefix: string
    ): boolean {
        const tries = 30;

        let best: {
            x: number;
            y: number;
            score: number;
            variant: EntityVariant;
        } | null = null;

        for (let i = 0; i < tries; i++) {
            const rA = this.generator.randomAtPoint(
                cx,
                cy,
                `${saltPrefix}_angle_${i}`
            );
            const rD = this.generator.randomAtPoint(
                cx,
                cy,
                `${saltPrefix}_dist_${i}`
            );

            const angle = rA * Math.PI * 2;
            const dist = Math.pow(rD, 1.4) * maxRadius;

            const px = Math.round(center.x + Math.cos(angle) * dist);
            const py = Math.round(center.y + Math.sin(angle) * dist);

            const localX = px - Math.floor(def.w / 2);
            const localY = py - Math.floor(def.h / 2);

            const worldTileX = origin.tileX + localX;
            const worldTileY = origin.tileY + localY;

            const variant = this.pickVariant(def, worldTileX, worldTileY);

            if (
                !this.canPlaceWithLayout(
                    localX,
                    localY,
                    def,
                    variant.layout,
                    buildingOcc,
                    placeable,
                    terrainTypes
                )
            )
                continue;

            const sampleX = Phaser.Math.Clamp(px, 0, CHUNK_SIZE_TILES - 1);
            const sampleY = Phaser.Math.Clamp(py, 0, CHUNK_SIZE_TILES - 1);
            const nearRiver = river01[sampleY][sampleX];

            const jitter =
                this.generator.randomAtPoint(cx, cy, `${saltPrefix}_jitter_${i}`) *
                0.03;

            const score = nearRiver + jitter;

            if (!best || score > best.score) {
                best = { x: localX, y: localY, score, variant };
            }
        }

        if (!best) return false;

        this.paintLayout(entityLayer, best.x, best.y, best.variant.layout);
        this.markOccupiedWithLayout(
            best.x,
            best.y,
            best.variant.layout,
            buildingOcc
        );
        return true;
    }

    // -----------------------------
    // Nature
    // -----------------------------

    private placeNature(
        origin: { tileX: number; tileY: number },
        entityLayer: Phaser.Tilemaps.TilemapLayer,
        occupied: boolean[][],
        placeable: boolean[][],
        terrainTypes: TerrainType[][],
        river01: number[][],
        forest01: number[][]
    ): void {
        const treeDef = this.getDef("TREE");
        const bushDef = this.getDef("BUSH");
        const mushroomDef = this.getDef("MUSHROOM");
        const boneDef = this.getDef("BONE");
        const rockDef = this.getDef("ROCK");
        const pebbleDef = this.getDef("PEBBLE");
        const riverRockDef = this.getDef("RIVER_ROCK");

        // ---- Trees (big, forest-driven density) ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;
                if (terrainTypes[y][x] !== "GRASS") continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const f = forest01[y][x];
                const r = river01[y][x];

                const chance = Phaser.Math.Clamp(0.01 + f * 0.22 + r * 0.03, 0, 0.28);

                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "TREE"
                );
                if (roll >= chance) continue;

                const variant = this.pickVariant(treeDef, worldTileX, worldTileY);

                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        treeDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }

        // ---- Bushes (GRASS only) : 5% ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;
                if (terrainTypes[y][x] !== "GRASS") continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "BUSH"
                );
                if (roll >= 0.05) continue;

                const variant = this.pickVariant(bushDef, worldTileX, worldTileY);
                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        bushDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }

        // ---- Mushrooms (STONE + GRASS) : 5% ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;

                const terrain = terrainTypes[y][x];
                if (terrain !== "GRASS" && terrain !== "STONE") continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "MUSHROOM"
                );
                if (roll >= 0.05) continue;

                const variant = this.pickVariant(mushroomDef, worldTileX, worldTileY);
                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        mushroomDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }

        // ---- Bones (GRASS + STONE + SAND) : 5% ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;

                const terrain = terrainTypes[y][x];
                if (terrain !== "GRASS" && terrain !== "STONE" && terrain !== "SAND")
                    continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "BONE"
                );
                if (roll >= 0.05) continue;

                const variant = this.pickVariant(boneDef, worldTileX, worldTileY);
                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        boneDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }

        // ---- Rocks ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;

                const terrain = terrainTypes[y][x];
                if (!rockDef.allowedTerrain.includes(terrain)) continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const base =
                    terrain === "STONE" ? 0.035 : terrain === "SAND" ? 0.012 : 0.008;
                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "ROCK"
                );

                if (roll >= base) continue;

                const variant = this.pickVariant(rockDef, worldTileX, worldTileY);
                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        rockDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }

        // ---- Pebbles ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;

                const terrain = terrainTypes[y][x];
                if (!pebbleDef.allowedTerrain.includes(terrain)) continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const base =
                    terrain === "SAND" ? 0.05 : terrain === "STONE" ? 0.03 : 0.012;
                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "PEBBLE"
                );

                if (roll >= base) continue;

                const variant = this.pickVariant(pebbleDef, worldTileX, worldTileY);

                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        pebbleDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }

        // ---- River rocks (visual decoration in rivers; can be placed on WATER even though it's solid) ----
        for (let y = 0; y < CHUNK_SIZE_TILES; y++) {
            for (let x = 0; x < CHUNK_SIZE_TILES; x++) {
                if (occupied[y][x]) continue;

                // Only in river water (ocean WATER has river01 = 0)
                if (terrainTypes[y][x] !== "WATER") continue;
                if (river01[y][x] < 0.82) continue;

                const worldTileX = origin.tileX + x;
                const worldTileY = origin.tileY + y;

                const roll = this.generator.randomForEntityAtTile(
                    worldTileX,
                    worldTileY,
                    "RIVER_ROCK"
                );

                // Light sprinkle so rivers look alive but not cluttered
                if (roll >= 0.018) continue;

                const variant = this.pickVariant(riverRockDef, worldTileX, worldTileY);

                if (
                    !this.canPlaceWithLayout(
                        x,
                        y,
                        riverRockDef,
                        variant.layout,
                        occupied,
                        placeable,
                        terrainTypes,
                        true // ignore placeable for water-only decoration
                    )
                )
                    continue;

                this.paintLayout(entityLayer, x, y, variant.layout);
                this.markOccupiedWithLayout(x, y, variant.layout, occupied);
            }
        }
    }

    // -----------------------------
    // NPCs
    // -----------------------------

    private placeNpcs(
        cx: number,
        cy: number,
        origin: { tileX: number; tileY: number },
        occupied: boolean[][],
        placeable: boolean[][],
        terrainTypes: TerrainType[][],
        settlement: SettlementInfo | null,
        objects: Phaser.GameObjects.GameObject[]
    ): void {
        if (!this.npcIdleVariants || this.npcIdleVariants.length === 0) return;

        const settlement01 = settlement
            ? Phaser.Math.Clamp(settlement.housesPlaced / 24, 0, 1)
            : 0;

        // ---- Increased NPC frequency ----
        const baseChunkChance = 0.06; // was 0.02
        const settleBonus =
            settlement01 * 0.26 +
            (settlement?.hasOutpost ? 0.09 : 0) +
            (settlement?.hasCastle ? 0.16 : 0);

        const spawnChance1 = Phaser.Math.Clamp(
            baseChunkChance + settleBonus,
            0,
            0.85
        );
        const spawnRoll1 = this.generator.randomAtPoint(cx, cy, "npc_spawn_1");
        let npcCount = spawnRoll1 < spawnChance1 ? 1 : 0;

        const spawnChance2 = Phaser.Math.Clamp(0.05 + settleBonus * 0.55, 0, 0.7);
        const spawnRoll2 = this.generator.randomAtPoint(cx, cy, "npc_spawn_2");
        if (spawnRoll2 < spawnChance2) npcCount += 1;

        const spawnChance3 = settlement
            ? Phaser.Math.Clamp(
                    0.02 + settlement01 * 0.2 + (settlement.hasCastle ? 0.08 : 0),
                    0,
                    0.45
              )
            : 0;
        const spawnRoll3 = this.generator.randomAtPoint(cx, cy, "npc_spawn_3");
        if (spawnRoll3 < spawnChance3) npcCount += 1;

        const spawnChance4 = settlement?.hasCastle
            ? Phaser.Math.Clamp(0.03 + settlement01 * 0.14, 0, 0.3)
            : 0;
        const spawnRoll4 = this.generator.randomAtPoint(cx, cy, "npc_spawn_4");
        if (spawnRoll4 < spawnChance4) npcCount += 1;

        if (npcCount <= 0) return;

        const center = settlement?.center ?? { x: 16, y: 16 };
        const nearRadius =
            settlement && settlement.housesPlaced > 0
                ? Math.min(14, 4 + Math.ceil(settlement.housesPlaced * 0.5)) + 6
                : 11;

        for (let n = 0; n < npcCount; n++) {
            let found: LocalPoint | null = null;

            const attempts = 110;
            for (let a = 0; a < attempts; a++) {
                const bias = settlement
                    ? this.generator.randomAtPoint(cx, cy, `npc_bias_${n}_${a}`)
                    : 1;

                let lx = 0;
                let ly = 0;

                if (settlement && bias < 0.86) {
                    // Prefer spawning near settlements
                    const rA = this.generator.randomAtPoint(
                        cx,
                        cy,
                        `npc_near_angle_${n}_${a}`
                    );
                    const rD = this.generator.randomAtPoint(
                        cx,
                        cy,
                        `npc_near_dist_${n}_${a}`
                    );

                    const angle = rA * Math.PI * 2;
                    const dist = Math.pow(rD, 1.7) * nearRadius;

                    lx = Math.round(center.x + Math.cos(angle) * dist);
                    ly = Math.round(center.y + Math.sin(angle) * dist);
                } else {
                    // Anywhere in the chunk
                    const rx = this.generator.randomAtPoint(
                        cx,
                        cy,
                        `npc_any_x_${n}_${a}`
                    );
                    const ry = this.generator.randomAtPoint(
                        cx,
                        cy,
                        `npc_any_y_${n}_${a}`
                    );
                    lx = Math.floor(rx * CHUNK_SIZE_TILES);
                    ly = Math.floor(ry * CHUNK_SIZE_TILES);
                }

                if (
                    lx < 0 ||
                    ly < 0 ||
                    lx >= CHUNK_SIZE_TILES ||
                    ly >= CHUNK_SIZE_TILES
                )
                    continue;
                if (occupied[ly][lx]) continue;
                if (!placeable[ly][lx]) continue;

                // Avoid WATER even if solid logic changes elsewhere
                if (terrainTypes[ly][lx] === "WATER") continue;

                found = { x: lx, y: ly };
                break;
            }

            if (!found) continue;

            occupied[found.y][found.x] = true;

            const worldTileX = origin.tileX + found.x;
            const worldTileY = origin.tileY + found.y;

            const rVar = this.generator.randomAtTile(
                worldTileX,
                worldTileY,
                `npc_variant_${n}`
            );
            const idx =
                Math.floor(rVar * this.npcIdleVariants.length) %
                this.npcIdleVariants.length;
            const variant = this.npcIdleVariants[idx] ?? this.npcIdleVariants[0];
            if (!variant) continue;

            this.unitStrips.ensureStripFrames(variant.textureKey);
            const scale = 0.4;

            let wx = (worldTileX + 0.5) * TILE_SIZE;
            let wy = (worldTileY + 0.5) * TILE_SIZE;

            const jx =
                (this.generator.randomAtTile(worldTileX, worldTileY, `npc_jx_${n}`) -
                    0.5) *
                TILE_SIZE *
                0.3;
            const jy =
                (this.generator.randomAtTile(worldTileX, worldTileY, `npc_jy_${n}`) -
                    0.5) *
                TILE_SIZE *
                0.2;

            wx += jx;
            wy += jy;

            const npc = this.scene.add
                .sprite(wx, wy, variant.textureKey, "f0")
                .setScale(scale)
                .setOrigin(0.5, 0.85)
                .setDepth(2);

            npc.play(variant.animKey, true);

            const face = this.generator.randomAtTile(
                worldTileX,
                worldTileY,
                `npc_face_${n}`
            );
            npc.setFlipX(face < 0.5);

            objects.push(npc);
        }
    }
}