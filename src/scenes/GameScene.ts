import Phaser from "phaser";
import {
    CHUNK_SIZE_PX,
    EMOJI_FONT_FAMILY,
    HALF_CHUNK_SIZE_PX,
    PLAYER_SPEED_PX_PER_SEC,
    SPRITESHEET_FRAME_SIZE,
    TILE_SIZE,
} from "../constants";
import WorldGenerator, { TerrainType, DEFAULT_ISLAND_CONFIG } from "../world/WorldGenerator";
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
    TEX_PLAYER_ATTACK1,
    TEX_PLAYER_ATTACK2,
    TEX_PLAYER_GUARD,
    TEX_PLAYER_IDLE,
    TEX_PLAYER_RUN,
    UNIT_COLORS,
    npcIdleAnimKey,
    unitIdleTextureKey,
} from "./tinySwords";
import { MultiplayerManager } from "../lib/multiplayer";
import { OtherPlayer } from "../entities/OtherPlayer";
import { AINPC } from "../entities/AINPC";
import { NPC_CHARACTERS } from "../data/npcCharacters";
import { PlayerData, PlayerState, Gender } from "../types";

type PlayerAnimState = "idle" | "run" | "attack1" | "attack2" | "guard";

interface ChatMessage {
    name: string;
    text: string;
    color: string;
}

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

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

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

    // --- Multiplayer properties ---
    private playerName: string = "Player";
    private playerGender: Gender = "male";
    private multiplayer!: MultiplayerManager;
    private otherPlayers: Map<string, OtherPlayer> = new Map();
    private playerCount!: Phaser.GameObjects.Text;
    private chatMessages: ChatMessage[] = [];
    private chatContainer!: Phaser.GameObjects.Container;
    private chatInput!: HTMLInputElement;
    private playerColors: Map<string, string> = new Map();
    private myColor!: string;
    private joystickBase!: Phaser.GameObjects.Arc;
    private joystickThumb!: Phaser.GameObjects.Arc;
    private joystickPointer: Phaser.Input.Pointer | null = null;
    private isMobile: boolean = false;
    private joystickX: number = 0;
    private joystickY: number = 0;

    // AI NPCs
    private aiNPCs: AINPC[] = [];
    private nearbyNPC: AINPC | null = null;
    private npcInteractionRadius: number = 100;
    private _talkingToNPC: boolean = false;

    // Player skin system - selected skin based on gender with directional animations
    private playerSkinKey: string = "";
    private playerSkinIndex: number = 1;
    private playerDirection: "down" | "left" | "right" | "up" = "down";

    // Skin definitions - 10 skins per gender
    private static readonly MALE_SKINS = Array.from({ length: 10 }, (_, i) =>
        `guest_male_${String(i + 1).padStart(2, "0")}`
    );
    private static readonly FEMALE_SKINS = Array.from({ length: 10 }, (_, i) =>
        `guest_female_${String(i + 1).padStart(2, "0")}`
    );

    constructor() {
        super({ key: "GameScene" });
    }

    init(data: { player?: PlayerData }): void {
        if (data.player) {
            this.playerName = data.player.name;
            this.playerGender = data.player.gender;
            this.playerSkinIndex = data.player.skinIndex || 1;
            // Set the skin key based on selected gender and skin index
            const skinNum = String(this.playerSkinIndex).padStart(2, "0");
            this.playerSkinKey = `guest_${this.playerGender}_${skinNum}`;
        }
    }

    preload(): void {
        this.load.spritesheet(SPRITESHEET_KEY, SPRITESHEET_URL, {
            frameWidth: SPRITESHEET_FRAME_SIZE,
            frameHeight: SPRITESHEET_FRAME_SIZE,
        });

        // Mini-map image
        this.load.image(MINIMAP_KEY, MINIMAP_URL);

        // --- Tiny Swords unit idle sheets (for NPCs + player idle) ---
        // Loading from public/assets/units/ with normalized naming
        const colorMap: Record<string, string> = {
            "blue": "Blue_Units",
            "red": "Red_Units",
            "yellow": "Yellow_Units",
            "purple": "Purple_Units",
            "black": "Black_Units",
        };
        const unitMap: Record<string, string> = {
            "warrior": "Warrior",
            "archer": "Archer",
            "lancer": "Lancer",
            "monk": "Monk",
            "pawn": "Pawn",
        };

        for (const c of UNIT_COLORS) {
            for (const u of NPC_UNIT_TYPES) {
                const key = unitIdleTextureKey(c.id, u.id);
                const colorFolder = colorMap[c.id];
                const unitName = unitMap[u.id];
                if (colorFolder && unitName) {
                    this.load.image(key, `/assets/units/${colorFolder}_${unitName}_Idle.png`);
                }
            }
        }

        // --- Player-specific warrior actions (run/attack/guard) ---
        // Loading from public/assets/sprites/
        this.load.image(TEX_PLAYER_RUN, "/assets/sprites/Warrior_Run.png");
        this.load.image(TEX_PLAYER_ATTACK1, "/assets/sprites/Warrior_Attack1.png");
        this.load.image(TEX_PLAYER_ATTACK2, "/assets/sprites/Warrior_Attack2.png");
        this.load.image(TEX_PLAYER_GUARD, "/assets/sprites/Warrior_Guard.png");

        // --- Load all player character skins (10 male + 10 female) ---
        // These are 4x4 spritesheets (512x512, 128x128 per frame)
        // Layout: Row 0 = down, Row 1 = left, Row 2 = right, Row 3 = up
        const allSkins = [...GameScene.MALE_SKINS, ...GameScene.FEMALE_SKINS];
        for (const skin of allSkins) {
            this.load.spritesheet(skin, `/assets/PlayCharacters/${skin}_preview.png`, {
                frameWidth: 128,
                frameHeight: 128,
            });
        }
    }

    async create(): Promise<void> {
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

        // Player sprite: Use selected character skin (4x4 spritesheet with directional animations)
        // Fallback to default skin if not set
        if (!this.playerSkinKey) {
            this.playerSkinKey = "guest_male_01";
        }

        // Player scale for 128x128 frame skins
        const playerScale = 0.5;

        this.player = this.add
            .sprite(0, 0, this.playerSkinKey, 0)
            .setScale(playerScale)
            .setOrigin(0.5, 0.85) // foot-ish anchor for top-down movement feel
            .setDepth(2);

        this.player.setFlipX(false);
        // Start with idle down animation for the selected skin
        this.player.play(`${this.playerSkinKey}_idle_down`, true);
        this.playerDirection = "down";

        // Ensure the player starts on walkable land (important now that WATER is solid).
        this.placePlayerAtSafeSpawn();

        // When walk animation completes a cycle, we can check for direction changes
        // (For skin-based characters, we use walk animations that loop indefinitely)

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

        // HUD (moved to right side to make room for chat)
        this.hud = this.add
            .text(GAME_WIDTH - 10, 10, "", {
                fontFamily: EMOJI_FONT_FAMILY,
                fontSize: "12px",
                align: "right",
            })
            .setOrigin(1, 0)
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

        // --- Multiplayer Setup ---
        // Player count display
        this.playerCount = this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 30, "Players: 1", {
            font: "bold 14px Arial",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
        });
        this.playerCount.setOrigin(1, 1);
        this.playerCount.setScrollFactor(0);
        this.playerCount.setDepth(1000);

        // Generate my color
        this.myColor = this.generateColor(this.playerName);

        // Check if mobile
        this.isMobile = this.checkMobile();

        // Create chat UI
        this.createChatUI();

        // Create mobile controls if on mobile
        if (this.isMobile) {
            this.createMobileControls();
        }

        // Create name tag for player
        this.createNameTag(this.playerName);

        // Initialize multiplayer
        await this.initMultiplayer();

        // Spawn AI NPCs
        this.spawnAINPCs();

        this.refreshHud();
    }

    // --- AI NPC Methods ---

    /**
     * NPCs spawn CLOSE TO PLAYER SPAWN for immediate interaction
     * Positioned in a semicircle around the spawn point so players meet them right away
     */
    private spawnAINPCs(): void {
        const cfg = DEFAULT_ISLAND_CONFIG;

        // Player spawns at island center - position NPCs in a close semicircle
        const spawnX = cfg.centerX * TILE_SIZE;
        const spawnY = cfg.centerY * TILE_SIZE;
        const npcRadius = 80; // Close enough for immediate interaction

        // NPCs positioned around spawn point - semi-circle formation
        const NPC_POSITIONS = [
            { id: 'balaji', x: spawnX - npcRadius, y: spawnY - 40 },      // Upper left
            { id: 'jackson', x: spawnX + npcRadius, y: spawnY - 40 },     // Upper right
            { id: 'otavio', x: spawnX - npcRadius - 20, y: spawnY + 60 }, // Lower left
            { id: 'yash', x: spawnX + npcRadius + 20, y: spawnY + 60 },   // Lower right
        ];

        NPC_CHARACTERS.forEach((character, index) => {
            const pos = NPC_POSITIONS[index];
            const npc = new AINPC(this, pos.x, pos.y, character);

            // Broadcast NPC messages to all players via multiplayer
            npc.setOnChat((name, text, color) => {
                this.addChatMessage(name, text, color);
                this.broadcastNPCChat(name, text, color);
            });

            this.aiNPCs.push(npc);
        });
    }

    /**
     * MODIFICATION 2: Broadcast NPC dialogue to all connected players
     */
    private broadcastNPCChat(name: string, text: string, color: string): void {
        if (this.multiplayer) {
            this.multiplayer.sendNPCChat(name, text, color);
        }
    }

    private updateNPCProximity(): void {
        let closest: AINPC | null = null;
        let closestDist = this.npcInteractionRadius;

        for (const npc of this.aiNPCs) {
            const dist = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                npc.x, npc.y
            );

            if (dist < closestDist) {
                closestDist = dist;
                closest = npc;
            }

            // Update player position so NPC can face them
            npc.setPlayerPosition(this.player.x, this.player.y);

            // Update in-range state
            npc.setPlayerInRange(dist < this.npcInteractionRadius);
        }

        this.nearbyNPC = closest;
    }

    private async talkToNearbyNPC(message: string): Promise<void> {
        if (this.nearbyNPC && !this.nearbyNPC.isProcessing()) {
            this._talkingToNPC = true;
            await this.nearbyNPC.respondToPlayer(message);
            this._talkingToNPC = false;
        }
    }

    // --- Multiplayer Methods ---

    private checkMobile(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 2);
    }

    private generateColor(name: string): string {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        const s = 70 + (Math.abs(hash >> 8) % 20);
        const l = 55 + (Math.abs(hash >> 16) % 15);
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    private getPlayerColor(name: string): string {
        if (!this.playerColors.has(name)) {
            this.playerColors.set(name, this.generateColor(name));
        }
        return this.playerColors.get(name)!;
    }

    private createMobileControls(): void {
        const joystickX = 90;
        const joystickY = GAME_HEIGHT - 110;
        const baseRadius = 60;
        const thumbRadius = 30;

        // Joystick base with better visibility
        this.joystickBase = this.add.circle(joystickX, joystickY, baseRadius, 0x000000, 0.5);
        this.joystickBase.setStrokeStyle(3, 0x4ade80, 0.8);
        this.joystickBase.setScrollFactor(0);
        this.joystickBase.setDepth(999);

        // Joystick thumb
        this.joystickThumb = this.add.circle(joystickX, joystickY, thumbRadius, 0x4ade80, 0.7);
        this.joystickThumb.setStrokeStyle(2, 0xffffff, 0.5);
        this.joystickThumb.setScrollFactor(0);
        this.joystickThumb.setDepth(1000);

        // Interaction button (bottom-right area) - for talking to NPCs
        const interactBtn = this.add.circle(GAME_WIDTH - 70, GAME_HEIGHT - 80, 35, 0x4ade80, 0.7);
        interactBtn.setStrokeStyle(3, 0xffffff, 0.5);
        interactBtn.setScrollFactor(0);
        interactBtn.setDepth(999);
        interactBtn.setInteractive();

        const interactIcon = this.add.text(GAME_WIDTH - 70, GAME_HEIGHT - 80, "💬", {
            font: "28px Arial",
        });
        interactIcon.setOrigin(0.5);
        interactIcon.setScrollFactor(0);
        interactIcon.setDepth(1000);

        interactBtn.on("pointerdown", () => {
            // Open chat input for NPC interaction
            if (this.nearbyNPC) {
                this.chatInput.style.display = "block";
                this.chatInput.focus();
            }
        });

        // Chat button (top of attack button)
        const chatBtn = this.add.circle(GAME_WIDTH - 70, GAME_HEIGHT - 160, 30, 0x4ade80, 0.7);
        chatBtn.setStrokeStyle(2, 0xffffff, 0.5);
        chatBtn.setScrollFactor(0);
        chatBtn.setDepth(999);
        chatBtn.setInteractive();

        const chatIcon = this.add.text(GAME_WIDTH - 70, GAME_HEIGHT - 160, "💬", {
            font: "22px Arial",
        });
        chatIcon.setOrigin(0.5);
        chatIcon.setScrollFactor(0);
        chatIcon.setDepth(1000);

        chatBtn.on("pointerdown", () => {
            this.chatInput.style.display = "block";
            this.chatInput.focus();
        });

        // Joystick touch handling
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            // Left half of screen and bottom area for joystick
            if (pointer.x < GAME_WIDTH / 2 && pointer.y > GAME_HEIGHT / 3) {
                this.joystickPointer = pointer;
            }
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
                this.updateJoystick(pointer);
            }
        });

        this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
            if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
                this.resetJoystick();
            }
        });
    }

    private updateJoystick(pointer: Phaser.Input.Pointer): void {
        const joystickX = 90;
        const joystickY = GAME_HEIGHT - 110;
        const maxDistance = 50;

        const dx = pointer.x - joystickX;
        const dy = pointer.y - joystickY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let nx = dx;
        let ny = dy;

        if (distance > maxDistance) {
            nx = (dx / distance) * maxDistance;
            ny = (dy / distance) * maxDistance;
        }

        this.joystickThumb.setPosition(joystickX + nx, joystickY + ny);
        this.joystickX = nx / maxDistance;
        this.joystickY = ny / maxDistance;
    }

    private resetJoystick(): void {
        const joystickX = 90;
        const joystickY = GAME_HEIGHT - 110;

        this.joystickThumb.setPosition(joystickX, joystickY);
        this.joystickPointer = null;
        this.joystickX = 0;
        this.joystickY = 0;
    }

    /**
     * MODIFICATION 4: Expanded chatbox - DOUBLE SIZE (500x380)
     * - Supports 15 visible messages without truncation
     * - Scrolls downward to show latest messages
     */
    private createChatUI(): void {
        this.chatContainer = this.add.container(10, 10);
        this.chatContainer.setScrollFactor(0);
        this.chatContainer.setDepth(1000);

        // DOUBLED chat area: 500x380 (was 320x220)
        const chatBg = this.add.rectangle(0, 0, 500, 380, 0x000000, 0.7);
        chatBg.setOrigin(0, 0);
        chatBg.setStrokeStyle(2, 0x4ade80, 0.6);
        this.chatContainer.add(chatBg);

        const title = this.add.text(10, 5, "Chat (15 messages)", {
            font: "bold 14px Arial",
            color: "#4ade80",
        });
        this.chatContainer.add(title);

        this.createChatInput();

        if (!this.isMobile) {
            const instructions = this.add.text(10, GAME_HEIGHT - 20, "Enter: Chat | Q/E: Attack | Shift: Guard | WASD: Move", {
                font: "11px Arial",
                color: "#666666",
            });
            instructions.setScrollFactor(0);
            instructions.setDepth(1000);
        }
    }

    private createChatInput(): void {
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / GAME_WIDTH;
        const scaleY = rect.height / GAME_HEIGHT;

        this.chatInput = document.createElement("input");
        this.chatInput.type = "text";
        this.chatInput.placeholder = "Type message...";
        this.chatInput.maxLength = 300;
        this.chatInput.style.cssText = `
            position: absolute;
            width: 480px;
            padding: 8px 12px;
            font-size: 13px;
            border: 2px solid #4ade80;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.95);
            color: #ffffff;
            outline: none;
            display: none;
        `;

        // Position below the expanded chat area (380px + 10px padding)
        this.chatInput.style.left = `${rect.left + 10 * scaleX}px`;
        this.chatInput.style.top = `${rect.top + 395 * scaleY}px`;

        document.body.appendChild(this.chatInput);

        this.chatInput.addEventListener("keydown", (e) => {
            // Stop all key events from reaching the game
            e.stopPropagation();

            if (e.key === "Enter" && this.chatInput.value.trim()) {
                this.sendChatMessage(this.chatInput.value.trim());
                this.chatInput.value = "";
                this.chatInput.style.display = "none";
                this.game.canvas.focus();
            } else if (e.key === "Escape") {
                this.chatInput.value = "";
                this.chatInput.style.display = "none";
                this.game.canvas.focus();
            }
        });

        // Also stop keyup and keypress to fully isolate chat input
        this.chatInput.addEventListener("keyup", (e) => e.stopPropagation());
        this.chatInput.addEventListener("keypress", (e) => e.stopPropagation());

        this.chatInput.addEventListener("focus", () => {
            if (this.input.keyboard) {
                this.input.keyboard.enabled = false;
            }
        });

        this.chatInput.addEventListener("blur", () => {
            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
            }
        });

        this.input.keyboard?.on("keydown-ENTER", () => {
            if (this.chatInput.style.display === "none") {
                this.chatInput.style.display = "block";
                this.chatInput.focus();
            }
        });
    }

    private sendChatMessage(text: string): void {
        // Add our message to chat
        this.addChatMessage(this.playerName, text, this.myColor);

        // If near an NPC, talk to them instead of broadcasting
        if (this.nearbyNPC) {
            this.talkToNearbyNPC(text);
        } else if (this.multiplayer) {
            // Otherwise send to multiplayer
            this.multiplayer.sendChat(text);
        }
    }

    /**
     * MODIFICATION 4: Support 15 messages in expanded chatbox
     */
    private addChatMessage(name: string, text: string, color: string): void {
        this.chatMessages.push({ name, text, color });
        // Keep up to 15 messages (was 8)
        if (this.chatMessages.length > 15) {
            this.chatMessages.shift();
        }
        this.renderChatMessages();
    }

    /**
     * MODIFICATION 4: Render messages in expanded chatbox with scrolling
     */
    private renderChatMessages(): void {
        this.chatContainer.each((child: Phaser.GameObjects.GameObject) => {
            if (child.getData("isMessage")) {
                child.destroy();
            }
        });

        let yOffset = 25;
        const maxHeight = 360; // Leave room for title and padding

        this.chatMessages.forEach((msg) => {
            // Skip rendering if we've exceeded the visible area
            if (yOffset > maxHeight) return;

            const nameText = this.add.text(10, yOffset, `${msg.name}:`, {
                font: "bold 12px Arial",
                color: msg.color,
            });
            nameText.setData("isMessage", true);
            this.chatContainer.add(nameText);

            // Wider word wrap for expanded chatbox (was 290, now 460)
            const msgText = this.add.text(15 + nameText.width, yOffset, ` ${msg.text}`, {
                font: "12px Arial",
                color: "#ffffff",
                wordWrap: { width: 460 - nameText.width },
            });
            msgText.setData("isMessage", true);
            this.chatContainer.add(msgText);

            // Move to next line based on message height
            yOffset += Math.max(msgText.height, 20) + 4;
        });
    }

    private async initMultiplayer(): Promise<void> {
        try {
            const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            this.multiplayer = new MultiplayerManager(
                playerId,
                this.playerName,
                this.playerGender,
                this.player.x,
                this.player.y
            );

            this.multiplayer.onJoin((playerState: PlayerState) => {
                this.addOtherPlayer(playerState);
                this.updatePlayerCount();
            });

            this.multiplayer.onLeave((playerId: string) => {
                this.removeOtherPlayer(playerId);
                this.updatePlayerCount();
            });

            this.multiplayer.onMove((playerState: PlayerState) => {
                this.updateOtherPlayer(playerState);
            });

            this.multiplayer.onChatMessage((_playerId: string, name: string, text: string) => {
                const color = this.getPlayerColor(name);
                this.addChatMessage(name, text, color);
            });

            // MODIFICATION 2: Receive NPC chat from other players for synchronized experience
            this.multiplayer.onNPCChatMessage((npcName: string, text: string, color: string) => {
                this.addChatMessage(npcName, text, color);
            });

            await this.multiplayer.connect();
        } catch (error) {
            console.error("Failed to connect to multiplayer:", error);
        }
    }

    private addOtherPlayer(playerState: PlayerState): void {
        if (this.otherPlayers.has(playerState.id)) return;

        const otherPlayer = new OtherPlayer(
            this,
            playerState.x,
            playerState.y,
            playerState.id,
            playerState.name,
            playerState.gender
        );

        this.otherPlayers.set(playerState.id, otherPlayer);
    }

    private removeOtherPlayer(playerId: string): void {
        const otherPlayer = this.otherPlayers.get(playerId);
        if (otherPlayer) {
            otherPlayer.destroy();
            this.otherPlayers.delete(playerId);
        }
    }

    private updateOtherPlayer(playerState: PlayerState): void {
        let otherPlayer = this.otherPlayers.get(playerState.id);

        if (!otherPlayer) {
            this.addOtherPlayer(playerState);
            otherPlayer = this.otherPlayers.get(playerState.id);
        }

        if (otherPlayer) {
            otherPlayer.updatePosition(
                playerState.x,
                playerState.y,
                playerState.direction,
                playerState.isMoving
            );
        }
    }

    private updatePlayerCount(): void {
        const count = this.otherPlayers.size + 1;
        this.playerCount.setText(`Players: ${count}`);
    }

    private createNameTag(name: string): void {
        const nameTag = this.add.text(0, -50, name, {
            font: "bold 12px Arial",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
        });
        nameTag.setOrigin(0.5);
        nameTag.setDepth(1001);

        this.events.on("update", () => {
            nameTag.setPosition(this.player.x, this.player.y - 50);
        });
    }

    update(_time: number, delta: number): void {
        const dt = delta / 1000;

        let moveX = 0;
        let moveY = 0;

        // Keyboard input
        if (this.keyW.isDown) moveY -= 1;
        if (this.keyS.isDown) moveY += 1;
        if (this.keyA.isDown) moveX -= 1;
        if (this.keyD.isDown) moveX += 1;

        // Mobile joystick input
        if (this.joystickX !== 0 || this.joystickY !== 0) {
            moveX = this.joystickX;
            moveY = this.joystickY;
        }

        // Determine direction for 4-directional animations
        const isMoving = moveX !== 0 || moveY !== 0;
        let newDirection = this.playerDirection;

        if (isMoving) {
            // Determine primary direction based on largest movement component
            if (Math.abs(moveX) > Math.abs(moveY)) {
                newDirection = moveX > 0 ? "right" : "left";
            } else {
                newDirection = moveY > 0 ? "down" : "up";
            }
        }

        // Update direction and animation if changed or movement state changed
        const wasMoving = this.playerState === "run";
        const directionChanged = newDirection !== this.playerDirection;
        const movingStateChanged = isMoving !== wasMoving;

        if (directionChanged || movingStateChanged) {
            this.playerDirection = newDirection;

            if (isMoving) {
                // Play walk animation for current direction
                this.player.play(`${this.playerSkinKey}_walk_${this.playerDirection}`, true);
                this.playerState = "run";
            } else {
                // Play idle animation for current direction
                this.player.play(`${this.playerSkinKey}_idle_${this.playerDirection}`, true);
                this.playerState = "idle";
            }
        }

        // Update facing for compatibility with multiplayer direction broadcasting
        if (moveX !== 0) {
            this.playerFacingX = moveX > 0 ? 1 : -1;
        }

        const allowMove = true;

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

        // Broadcast position to other players
        if (this.multiplayer) {
            const direction = this.playerFacingX > 0 ? "right" : "left";
            this.multiplayer.broadcastPosition(
                this.player.x,
                this.player.y,
                direction,
                isMoving && allowMove
            );
        }

        // Update other players
        this.otherPlayers.forEach((otherPlayer) => {
            otherPlayer.update();
        });

        // Update AI NPCs
        this.updateNPCProximity();
        this.aiNPCs.forEach((npc) => {
            npc.update();
        });

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

    /**
     * MODIFICATION 1: Find walkable tile prioritizing UPWARD direction
     * This ensures NPCs are placed above water/obstacles when possible
     */
    private findNearestWalkableTileUpward(
        startTileX: number,
        startTileY: number,
        maxRadius: number
    ): { tileX: number; tileY: number } {
        // First check if starting position is already walkable
        if (!this.generator.isSolidAtTile(startTileX, startTileY)) {
            return { tileX: startTileX, tileY: startTileY };
        }

        // Search in expanding rings, but check UPWARD tiles first
        for (let r = 1; r <= maxRadius; r++) {
            // Priority 1: Check tiles directly above (negative Y = upward)
            for (let dx = -r; dx <= r; dx++) {
                const tx = startTileX + dx;
                const ty = startTileY - r; // Upward first
                if (!this.generator.isSolidAtTile(tx, ty)) {
                    return { tileX: tx, tileY: ty };
                }
            }

            // Priority 2: Check sides at this radius
            for (let dy = -r + 1; dy <= r - 1; dy++) {
                // Left side
                if (!this.generator.isSolidAtTile(startTileX - r, startTileY + dy)) {
                    return { tileX: startTileX - r, tileY: startTileY + dy };
                }
                // Right side
                if (!this.generator.isSolidAtTile(startTileX + r, startTileY + dy)) {
                    return { tileX: startTileX + r, tileY: startTileY + dy };
                }
            }

            // Priority 3: Check tiles below (only as last resort)
            for (let dx = -r; dx <= r; dx++) {
                const tx = startTileX + dx;
                const ty = startTileY + r; // Downward last
                if (!this.generator.isSolidAtTile(tx, ty)) {
                    return { tileX: tx, tileY: ty };
                }
            }
        }

        // Fallback: return original position
        return { tileX: startTileX, tileY: startTileY };
    }

    private placePlayerAtSafeSpawn(): void {
        // For island mode, spawn on the main path area (center of island)
        const cfg = DEFAULT_ISLAND_CONFIG;
        const startTileX = cfg.centerX;
        const startTileY = cfg.centerY; // Spawn near center of the island on the path

        // Still do a safety check in case spawn tile is occupied
        const maxRadiusTiles = 20;

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
    // Player animation state (skin-based directional animations)
    // -----------------------------

    /**
     * Play skin-based animation for current direction
     * Skins have: idle_down, idle_up, idle_left, idle_right, walk_down, walk_up, walk_left, walk_right
     */
    private playDirectionalAnimation(isMoving: boolean): void {
        const animType = isMoving ? "walk" : "idle";
        const animKey = `${this.playerSkinKey}_${animType}_${this.playerDirection}`;
        this.player.play(animKey, true);
        this.playerState = isMoving ? "run" : "idle";
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
        this.blockedHintText = `Blocked by ${terrainType}`;
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

        const npcInfo = this.nearbyNPC
            ? `\nTalking to: ${this.nearbyNPC.npcName}`
            : "";

        this.hud.setText(
            `Chunk: (${chunkX}, ${chunkY}) Tile: (${tileX}, ${tileY})\n` +
                `Terrain: ${t.type}\n` +
                `${this.playerState} | ${this.playerFacingX > 0 ? "R" : "L"}\n` +
                `Chunks: ${stats.loadedCount}/${stats.activeCount || 9}` +
                blocked +
                npcInfo
        );
    }

    // -----------------------------
    // Cleanup
    // -----------------------------

    shutdown(): void {
        if (this.multiplayer) {
            this.multiplayer.disconnect();
        }
        if (this.chatInput?.parentNode) {
            this.chatInput.remove();
        }
    }
}
