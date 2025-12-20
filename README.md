# AIRPG Phaser Frontend (src/)

This repo now contains a **single-scene Phaser 3 + TypeScript + Vite** frontend that matches the AIRPG spec:
- Deterministic procedural terrain (`src/world/WorldGenerator.ts`)
- 3×3 chunk streaming with time-sliced load/unload (`src/scenes/systems/ChunkManager.ts`)
- Chunk building (tile layers + settlements + nature + NPCs) (`src/scenes/builders/WorldChunkBuilder.ts`)
- Tiny Swords unit strip slicing + animation registration (`src/scenes/systems/UnitStripManager.ts`)

> Note: The runtime expects a world spritesheet at `sprites/spritesheet.png` (frame size 64×64).
> Tiny Swords assets are loaded from the `Tiny Swords/` directory already in the repo.

## Run locally

### Prereqs
- Node.js (LTS recommended)
- npm

### Install & start
```bash
npm install
npm run dev
````

### Build & preview

```bash
npm run build
npm run preview
```

## Controls

* Move: **WASD**
* Guard: **Shift** (blocks movement)
* Attack 1: **Q** (locks until anim completes)
* Attack 2: **E** (locks until anim completes)

## Key files

* `src/main.ts` — Phaser game config (RESIZE scaling) + window resize hook
* `src/scenes/GameScene.ts` — main loop: input, state machine, collision, chunk streaming, HUD
* `src/world/WorldGenerator.ts` — terrain signals + determinism helpers + entity definitions
* `src/scenes/builders/WorldChunkBuilder.ts` — builds tilemap layers + placements + NPC sprites
* `src/scenes/systems/ChunkManager.ts` — 3×3 active window streaming with time budgets
* `src/scenes/systems/UnitStripManager.ts` — strip-to-frames + animation creation
* `src/scenes/tinySwords.ts` — asset URL helpers + standardized keys
* `src/tileset/*` — tileset manifest helpers (not used by the runtime scene currently)