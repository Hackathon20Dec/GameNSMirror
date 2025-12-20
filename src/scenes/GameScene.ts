import Phaser from "phaser";
import {
    CHUNK_SIZE_PX,
    EMOJI_FONT_FAMILY,
    HALF_CHUNK_SIZE_PX,
    PLAYER_SPEED_PX_PER_SEC,
    SPRITESHEET_FRAME_SIZE,
    SPRITESHEET_SCALE,
    TILE_SIZE,
} from "../constants";
import WorldGenerator, { TerrainType } from "../world/WorldGenerator";
import WorldChunkBuilder, {
    NpcIdleVariant,
} from "./builders/WorldChunkBuilder";
import ChunkManager from "./systems/ChunkManager";
import UnitStripManager from "./systems/UnitStripManager";
import MiniMapOverlay from "./systems/MiniMapOverlay";
import {
    ANIM_PLAYER_ATTACK1,
    ANIM_PLAYER_ATTACK2,
    ANIM_PLAYER_GUARD,
    ANIM_PLAYER_IDLE,
    ANIM_PLAYER_RUN,
    NPC_UNIT_TYPES,
    PLAYER_COLOR_ID,
    TEX_PLAYER_ATTACK1,
    TEX_PLAYER_ATTACK2,
    TEX_PLAYER_GUARD,
    TEX_PLAYER_IDLE,
    TEX_PLAYER_RUN,
    UNIT_COLORS,
    assetUrl,
    npcIdleAnimKey,
    unitIdleTextureKey,
} from "./tinySwords";

type PlayerAnimState = "idle" | "run" | "attack1" | "attack2" | "guard";

const SPRITESHEET_KEY = "world_sheet";
const SPRITESHEET_URL = new URL(
    "../../sprites/spritesheet.png",
    import.meta.url
).toString();

const MINIMAP_KEY = "mini_map";
const MINIMAP_URL = new URL(
    "../../sprites/mini_map.png",
    import.meta.url
).toString();

export default class GameScene extends Phaser.Scene {
    private generator!: WorldGenerator;

    private player!: Phaser.GameObjects.Sprite;

    private keyW!: Phaser.Input.Keyboard.Key;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyS!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;

    private keyQ!: Phaser.Input.Keyboard.Key;
    private keyE!: Phaser.Input.Keyboard.Key;
    private keyShift!: Phaser.Input.Keyboard.Key;

    private hud!: Phaser.GameObjects.Text;
    private miniMapOverlay!: MiniMapOverlay;

    private chunkManager!: ChunkManager;
    private chunkBuilder!: WorldChunkBuilder;

    private unitStrips!: UnitStripManager;
    private npcIdleVariants: NpcIdleVariant[] = [];

    // Small per-frame budget to keep the game responsive
    private readonly chunkWorkBudgetMs = 6;

    // Movement blocked hint
    private blockedHintUntilMs = 0;
    private blockedHintText = "";

    // Player anim state
    private playerState: PlayerAnimState = "idle";
    private playerFacingX: 1 | -1 = 1; // default facing right
    private playerActionLocked = false;

    constructor() {
        super({ key: "GameScene" });
    }

    preload(): void {
        this.load.spritesheet(SPRITESHEET_KEY, SPRITESHEET_URL, {
            frameWidth: SPRITESHEET_FRAME_SIZE,
            frameHeight: SPRITESHEET_FRAME_SIZE,
        });

        // Mini-map image
        this.load.image(MINIMAP_KEY, MINIMAP_URL);

        // --- Tiny Swords unit idle sheets (for NPCs + player idle) ---
        for (const c of UNIT_COLORS) {
            for (const u of NPC_UNIT_TYPES) {
                const key = unitIdleTextureKey(c.id, u.id);
                const rel = `../../Tiny Swords/Units/${c.folder}/${u.folder}/${u.idleFile}`;
                this.load.image(key, assetUrl(rel));
            }
        }

        // --- Player-specific warrior actions (run/attack/guard) ---
        const playerColorFolder =
            UNIT_COLORS.find((c) => c.id === PLAYER_COLOR_ID)?.folder ?? "Blue Units";
        const warriorBase = `../../Tiny Swords/Units/${playerColorFolder}/Warrior/`;

        this.load.image(TEX_PLAYER_RUN, assetUrl(`${warriorBase}Warrior_Run.png`));
        this.load.image(
            TEX_PLAYER_ATTACK1,
            assetUrl(`${warriorBase}Warrior_Attack1.png`)
        );
        this.load.image(
            TEX_PLAYER_ATTACK2,
            assetUrl(`${warriorBase}Warrior_Attack2.png`)
        );
        this.load.image(
            TEX_PLAYER_GUARD,
            assetUrl(`${warriorBase}Warrior_Guard.png`)
        );
    }

    create(): void {
        // Ensure crisp pixels even when scaled (world spritesheet)
        if (this.textures.exists(SPRITESHEET_KEY)) {
            this.textures
                .get(SPRITESHEET_KEY)
                .setFilter(Phaser.Textures.FilterMode.NEAREST);
        }

        // Mini-map: crisp pixels
        if (this.textures.exists(MINIMAP_KEY)) {
            this.textures
                .get(MINIMAP_KEY)
                .setFilter(Phaser.Textures.FilterMode.NEAREST);
        }

        // Generator seed (deterministic world)
        this.generator = new WorldGenerator("Seed42");

        // Unit strip helper (Tiny Swords)
        this.unitStrips = new UnitStripManager(this);

        // Ensure crisp pixels for unit textures
        for (const c of UNIT_COLORS) {
            for (const u of NPC_UNIT_TYPES) {
                this.unitStrips.setNearestFilterForTexture(
                    unitIdleTextureKey(c.id, u.id)
                );
            }
        }
        this.unitStrips.setNearestFilterForTexture(TEX_PLAYER_RUN);
        this.unitStrips.setNearestFilterForTexture(TEX_PLAYER_ATTACK1);
        this.unitStrips.setNearestFilterForTexture(TEX_PLAYER_ATTACK2);
        this.unitStrips.setNearestFilterForTexture(TEX_PLAYER_GUARD);

        // --- Register unit strip frames + animations ---
        // Player animations
        this.unitStrips.ensureStripAnimation(
            ANIM_PLAYER_IDLE,
            TEX_PLAYER_IDLE,
            6,
            -1
        );
        this.unitStrips.ensureStripAnimation(
            ANIM_PLAYER_RUN,
            TEX_PLAYER_RUN,
            10,
            -1
        );
        this.unitStrips.ensureStripAnimation(
            ANIM_PLAYER_GUARD,
            TEX_PLAYER_GUARD,
            8,
            -1
        );
        this.unitStrips.ensureStripAnimation(
            ANIM_PLAYER_ATTACK1,
            TEX_PLAYER_ATTACK1,
            12,
            0
        );
        this.unitStrips.ensureStripAnimation(
            ANIM_PLAYER_ATTACK2,
            TEX_PLAYER_ATTACK2,
            12,
            0
        );

        // NPC idle animations (any unit, any color)
        this.npcIdleVariants = [];
        for (const c of UNIT_COLORS) {
            for (const u of NPC_UNIT_TYPES) {
                const texKey = unitIdleTextureKey(c.id, u.id);
                const animKey = npcIdleAnimKey(c.id, u.id);

                this.unitStrips.ensureStripAnimation(animKey, texKey, 6, -1);

                if (this.textures.exists(texKey)) {
                    this.npcIdleVariants.push({
                        id: `${c.id}_${u.id}`,
                        textureKey: texKey,
                        animKey,
                    });
                }
            }
        }

        // Player sprite: Tiny Swords Warrior
        this.unitStrips.ensureStripFrames(TEX_PLAYER_IDLE);
        const playerScale = 0.4;

        this.player = this.add
            .sprite(0, 0, TEX_PLAYER_IDLE, "f0")
            .setScale(playerScale)
            .setOrigin(0.5, 0.85) // foot-ish anchor for top-down movement feel
            .setDepth(2);

        this.player.setFlipX(false); // default right
        this.player.play(ANIM_PLAYER_IDLE, true);

        // Ensure the player starts on walkable land (important now that WATER is solid).
        this.placePlayerAtSafeSpawn();

        // When attack animation finishes, return to guard/run/idle depending on input
        this.player.on(
            Phaser.Animations.Events.ANIMATION_COMPLETE,
            (anim: Phaser.Animations.Animation) => {
                if (
                    anim.key === ANIM_PLAYER_ATTACK1 ||
                    anim.key === ANIM_PLAYER_ATTACK2
                ) {
                    this.playerActionLocked = false;
                    this.refreshPlayerLocomotionAnimation();
                }
            }
        );

        // Camera follow
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setRoundPixels(true);

        // WASD + action keys
        if (!this.input.keyboard) {
            throw new Error("Keyboard input is not available.");
        }
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyShift = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SHIFT
        );

        // HUD
        this.hud = this.add
            .text(10, 10, "", {
                fontFamily: EMOJI_FONT_FAMILY,
                fontSize: "14px",
            })
            .setScrollFactor(0)
            .setDepth(1000);

        // Mini-map UI (bottom-left; click to expand/center)
        this.miniMapOverlay = new MiniMapOverlay(this, {
            textureKey: MINIMAP_KEY,
            pois: [
                { id: "coworking", name: "Coworking", u: 0.54, v: 0.32 },
                { id: "cafe", name: "Cafe", u: 0.65 , v: 0.60 },
                { id: "gym", name: "Gym", u: 0.64, v: 0.70 },
                { id: "13th_floor", name: "13th floor", u: 0.67, v: 0.55 },
            ],
        });
        this.miniMapOverlay.mount();

        // Chunk builder + streaming manager
        this.chunkBuilder = new WorldChunkBuilder({
            scene: this,
            generator: this.generator,
            worldTextureKey: SPRITESHEET_KEY,
            unitStrips: this.unitStrips,
            npcIdleVariants: this.npcIdleVariants,
        });

        this.chunkManager = new ChunkManager(
            this,
            { chunkSizePx: CHUNK_SIZE_PX, halfChunkSizePx: HALF_CHUNK_SIZE_PX },
            (cx, cy) => this.chunkBuilder.buildChunkObjects(cx, cy)
        );

        // Initial chunk planning + initial work
        this.chunkManager.refresh(this.player.x, this.player.y, true);
        this.chunkManager.processQueues(24);

        this.refreshHud();
    }

    update(_time: number, delta: number): void {
        const dt = delta / 1000;

        let moveX = 0;
        let moveY = 0;

        if (this.keyW.isDown) moveY -= 1;
        if (this.keyS.isDown) moveY += 1;
        if (this.keyA.isDown) moveX -= 1;
        if (this.keyD.isDown) moveX += 1;

        // Facing (left/right flip). Default right, keep last when moving only vertically.
        if (moveX !== 0) {
            this.playerFacingX = moveX > 0 ? 1 : -1;
        }
        this.player.setFlipX(this.playerFacingX < 0);

        const wantGuard = this.keyShift.isDown;
        const wantAttack1 = Phaser.Input.Keyboard.JustDown(this.keyQ);
        const wantAttack2 = Phaser.Input.Keyboard.JustDown(this.keyE);

        // Actions
        if (!this.playerActionLocked) {
            if (wantAttack1) {
                this.startPlayerAttack("attack1");
            } else if (wantAttack2) {
                this.startPlayerAttack("attack2");
            } else {
                // Locomotion/guard state selection
                if (wantGuard) {
                    this.applyPlayerState("guard");
                } else if (moveX !== 0 || moveY !== 0) {
                    this.applyPlayerState("run");
                } else {
                    this.applyPlayerState("idle");
                }
            }
        }

        // Movement is blocked while guarding or during attacks
        const allowMove = !this.playerActionLocked && !wantGuard;

        if (allowMove) {
            const len = Math.hypot(moveX, moveY);
            if (len > 0) {
                moveX /= len;
                moveY /= len;

                const dx = moveX * PLAYER_SPEED_PX_PER_SEC * dt;
                const dy = moveY * PLAYER_SPEED_PX_PER_SEC * dt;

                this.tryMoveWithCollision(dx, dy);
            }
        }

        // 9-chunk window around player
        this.chunkManager.refresh(this.player.x, this.player.y, false);

        // Time-sliced chunk work
        this.chunkManager.processQueues(this.chunkWorkBudgetMs);

        this.refreshHud();
    }

    // -----------------------------
    // Spawn safety (avoid starting on WATER)
    // -----------------------------

    private findNearestWalkableTile(
        startTileX: number,
        startTileY: number,
        maxRadius: number
    ): { tileX: number; tileY: number } {
        if (!this.generator.isSolidAtTile(startTileX, startTileY)) {
            return { tileX: startTileX, tileY: startTileY };
        }

        for (let r = 1; r <= maxRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    // ring only (not full square)
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

                    const tx = startTileX + dx;
                    const ty = startTileY + dy;

                    if (!this.generator.isSolidAtTile(tx, ty)) {
                        return { tileX: tx, tileY: ty };
                    }
                }
            }
        }

        // Fallback: return original even if it's solid (better than NaN positions)
        return { tileX: startTileX, tileY: startTileY };
    }

    private placePlayerAtSafeSpawn(): void {
        const startTileX = 0;
        const startTileY = 0;

        // Large enough to escape an unlucky ocean-at-origin seed without noticeable cost.
        const maxRadiusTiles = 220;

        const safe = this.findNearestWalkableTile(
            startTileX,
            startTileY,
            maxRadiusTiles
        );

        this.player.setPosition(
            (safe.tileX + 0.5) * TILE_SIZE,
            (safe.tileY + 0.5) * TILE_SIZE
        );
    }

    // -----------------------------
    // Player animation state
    // -----------------------------

    private applyPlayerState(state: PlayerAnimState): void {
        this.playerState = state;

        let animKey = ANIM_PLAYER_IDLE;

        if (state === "run") animKey = ANIM_PLAYER_RUN;
        else if (state === "guard") animKey = ANIM_PLAYER_GUARD;
        else if (state === "attack1") animKey = ANIM_PLAYER_ATTACK1;
        else if (state === "attack2") animKey = ANIM_PLAYER_ATTACK2;

        this.player.play(animKey, true);
    }

    private startPlayerAttack(which: "attack1" | "attack2"): void {
        this.playerActionLocked = true;
        this.applyPlayerState(which);
    }

    private refreshPlayerLocomotionAnimation(): void {
        if (this.playerActionLocked) return;

        const wantGuard = this.keyShift?.isDown ?? false;

        const moving =
            (this.keyW?.isDown ?? false) ||
            (this.keyA?.isDown ?? false) ||
            (this.keyS?.isDown ?? false) ||
            (this.keyD?.isDown ?? false);

        if (wantGuard) {
            this.applyPlayerState("guard");
        } else if (moving) {
            this.applyPlayerState("run");
        } else {
            this.applyPlayerState("idle");
        }
    }

    // -----------------------------
    // Player Collision (Water = ocean + rivers)
    // -----------------------------

    private worldToTileCoord(worldPx: number): number {
        return Math.floor(worldPx / TILE_SIZE);
    }

    private worldToChunkCoord(worldPx: number): number {
        return Math.floor((worldPx + HALF_CHUNK_SIZE_PX) / CHUNK_SIZE_PX);
    }

    private getTerrainAtWorld(
        worldX: number,
        worldY: number
    ): {
        tileX: number;
        tileY: number;
        terrainType: TerrainType;
        solid: boolean;
        river01: number;
        forest01: number;
    } {
        const tileX = this.worldToTileCoord(worldX);
        const tileY = this.worldToTileCoord(worldY);
        const terrain = this.generator.getTerrainAtTile(tileX, tileY);
        return {
            tileX,
            tileY,
            terrainType: terrain.type,
            solid: terrain.solid,
            river01: terrain.river01,
            forest01: terrain.forest01,
        };
    }

    private setBlockedHint(terrainType: TerrainType): void {
        this.blockedHintText = `🚫 Blocked by ${terrainType}`;
        this.blockedHintUntilMs = this.time.now + 900;
    }

    private tryMoveWithCollision(dx: number, dy: number): void {
        if (dx !== 0) {
            const nx = this.player.x + dx;
            const check = this.getTerrainAtWorld(nx, this.player.y);

            if (!check.solid) {
                this.player.x = nx;
            } else {
                this.setBlockedHint(check.terrainType);
            }
        }

        if (dy !== 0) {
            const ny = this.player.y + dy;
            const check = this.getTerrainAtWorld(this.player.x, ny);

            if (!check.solid) {
                this.player.y = ny;
            } else {
                this.setBlockedHint(check.terrainType);
            }
        }
    }

    // -----------------------------
    // HUD
    // -----------------------------

    private refreshHud(): void {
        const tileX = this.worldToTileCoord(this.player.x);
        const tileY = this.worldToTileCoord(this.player.y);

        const chunkX = this.worldToChunkCoord(this.player.x);
        const chunkY = this.worldToChunkCoord(this.player.y);

        const stats = this.chunkManager.getStats();

        const t = this.generator.getTerrainAtTile(tileX, tileY);

        const blocked =
            this.time.now < this.blockedHintUntilMs
                ? `\n${this.blockedHintText}`
                : "";

        this.hud.setText(
            `🧭 Chunk: (${chunkX}, ${chunkY})  🧱 Tile: (${tileX}, ${tileY})  📍 Px: (${this.player.x.toFixed(
                0
            )}, ${this.player.y.toFixed(0)})\n` +
                `🌍 Terrain: ${t.type}  🌊 River: ${t.river01.toFixed(
                    2
                )}  🌲 Forest: ${t.forest01.toFixed(2)}\n` +
                `🎭 Player: ${this.playerState}  ↔️ Facing: ${
                    this.playerFacingX > 0 ? "right" : "left"
                }\n` +
                `📦 Chunks: ${stats.loadedCount}/${
                    stats.activeCount || 9
                } loaded  ⏳ Queue: +${stats.pendingLoads} -${stats.pendingUnloads}` +
                blocked
        );
    }
}
