/**
    * Tiny Swords asset helpers + constants.
    *
    * Kept in /src/scenes so relative asset URLs remain consistent with GameScene.
    */

// Tiny Swords unit helpers
export const assetUrl = (relPathFromThisFile: string): string =>
    new URL(relPathFromThisFile, import.meta.url).toString();

export const UNIT_COLORS = [
    { id: "blue", folder: "Blue Units" },
    { id: "red", folder: "Red Units" },
    { id: "yellow", folder: "Yellow Units" },
    { id: "purple", folder: "Purple Units" },
    { id: "black", folder: "Black Units" },
] as const;

export const NPC_UNIT_TYPES = [
    { id: "warrior", folder: "Warrior", idleFile: "Warrior_Idle.png" },
    { id: "archer", folder: "Archer", idleFile: "Archer_Idle.png" },
    { id: "lancer", folder: "Lancer", idleFile: "Lancer_Idle.png" },
    { id: "monk", folder: "Monk", idleFile: "Idle.png" },
    { id: "pawn", folder: "Pawn", idleFile: "Pawn_Idle.png" },
] as const;

export type UnitColorId = (typeof UNIT_COLORS)[number]["id"];
export type NpcUnitId = (typeof NPC_UNIT_TYPES)[number]["id"];

export const unitIdleTextureKey = (colorId: string, unitId: string): string =>
    `unit_${colorId}_${unitId}_idle`;
export const npcIdleAnimKey = (colorId: string, unitId: string): string =>
    `npc_${colorId}_${unitId}_idle`;

// Player: Warrior (Tiny Swords)
export const PLAYER_COLOR_ID: UnitColorId = "blue";
export const PLAYER_UNIT_ID: NpcUnitId = "warrior";

export const TEX_PLAYER_IDLE = unitIdleTextureKey(PLAYER_COLOR_ID, PLAYER_UNIT_ID);
export const TEX_PLAYER_RUN = `unit_${PLAYER_COLOR_ID}_${PLAYER_UNIT_ID}_run`;
export const TEX_PLAYER_ATTACK1 = `unit_${PLAYER_COLOR_ID}_${PLAYER_UNIT_ID}_attack1`;
export const TEX_PLAYER_ATTACK2 = `unit_${PLAYER_COLOR_ID}_${PLAYER_UNIT_ID}_attack2`;
export const TEX_PLAYER_GUARD = `unit_${PLAYER_COLOR_ID}_${PLAYER_UNIT_ID}_guard`;

export const ANIM_PLAYER_IDLE = "player_idle";
export const ANIM_PLAYER_RUN = "player_run";
export const ANIM_PLAYER_ATTACK1 = "player_attack1";
export const ANIM_PLAYER_ATTACK2 = "player_attack2";
export const ANIM_PLAYER_GUARD = "player_guard";