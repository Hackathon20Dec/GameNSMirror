import Phaser from "phaser";

export type ChunkKey = string;

export interface ActiveChunk {
    cx: number;
    cy: number;
    objects: Phaser.GameObjects.GameObject[];
    loaded: boolean;
}

interface ChunkLoadTask {
    cx: number;
    cy: number;
    key: ChunkKey;
}

export interface ChunkManagerConfig {
    chunkSizePx: number;
    halfChunkSizePx: number;
}

export interface ChunkManagerStats {
    activeCount: number;
    loadedCount: number;
    pendingLoads: number;
    pendingUnloads: number;
}

/**
    * 9-chunk rule streaming (3x3 around the center chunk).
    * Keeps the scene responsive by time-slicing chunk load/unload work.
    */
export default class ChunkManager {
    private readonly scene: Phaser.Scene;
    private readonly config: ChunkManagerConfig;
    private readonly buildChunkObjects: (
        cx: number,
        cy: number
    ) => Phaser.GameObjects.GameObject[];

    private readonly activeChunks = new Map<ChunkKey, ActiveChunk>();

    private lastCenterChunkX: number | null = null;
    private lastCenterChunkY: number | null = null;

    private pendingChunkLoads: ChunkLoadTask[] = [];
    private pendingLoadKeys = new Set<ChunkKey>();
    private pendingChunkUnloads: ActiveChunk[] = [];

    constructor(
        scene: Phaser.Scene,
        config: ChunkManagerConfig,
        buildChunkObjects: (cx: number, cy: number) => Phaser.GameObjects.GameObject[]
    ) {
        this.scene = scene;
        this.config = config;
        this.buildChunkObjects = buildChunkObjects;
    }

    public getStats(): ChunkManagerStats {
        let loadedCount = 0;
        for (const c of this.activeChunks.values()) {
            if (c.loaded) loadedCount++;
        }

        return {
            activeCount: this.activeChunks.size,
            loadedCount,
            pendingLoads: this.pendingChunkLoads.length,
            pendingUnloads: this.pendingChunkUnloads.length,
        };
    }

    public refresh(centerWorldX: number, centerWorldY: number, force: boolean): void {
        const centerCx = this.worldToChunkCoord(centerWorldX);
        const centerCy = this.worldToChunkCoord(centerWorldY);

        if (
            !force &&
            this.lastCenterChunkX === centerCx &&
            this.lastCenterChunkY === centerCy
        ) {
            return;
        }

        this.lastCenterChunkX = centerCx;
        this.lastCenterChunkY = centerCy;

        const needed = new Set<ChunkKey>();

        // 3x3 around player; load center first
        const offsets: Array<{ dx: number; dy: number }> = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) offsets.push({ dx, dy });
        }
        offsets.sort(
            (a, b) =>
                Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy))
        );

        for (const { dx, dy } of offsets) {
            const cx = centerCx + dx;
            const cy = centerCy + dy;
            const key = this.chunkKey(cx, cy);

            needed.add(key);

            if (!this.activeChunks.has(key)) {
                this.activeChunks.set(key, { cx, cy, objects: [], loaded: false });
                this.enqueueChunkLoad(cx, cy, key);
            }
        }

        // Unload chunks no longer needed
        const toRemove: ChunkKey[] = [];
        for (const key of this.activeChunks.keys()) {
            if (!needed.has(key)) toRemove.push(key);
        }

        for (const key of toRemove) {
            const chunk = this.activeChunks.get(key);
            if (!chunk) continue;

            this.activeChunks.delete(key);
            this.cancelPendingLoad(key);

            if (chunk.objects.length > 0) {
                this.pendingChunkUnloads.push(chunk);
            }
        }
    }

    public processQueues(budgetMs: number): void {
        const start = performance.now();

        // Loads first
        while (
            this.pendingChunkLoads.length > 0 &&
            performance.now() - start < budgetMs
        ) {
            const task = this.pendingChunkLoads.shift();
            if (!task) break;

            if (!this.pendingLoadKeys.has(task.key)) continue;

            const placeholder = this.activeChunks.get(task.key);
            if (!placeholder) {
                this.pendingLoadKeys.delete(task.key);
                continue;
            }

            const objects = this.buildChunkObjects(task.cx, task.cy);
            placeholder.objects = objects;
            placeholder.loaded = true;

            this.pendingLoadKeys.delete(task.key);
        }

        // Unloads
        while (
            this.pendingChunkUnloads.length > 0 &&
            performance.now() - start < budgetMs
        ) {
            const chunk = this.pendingChunkUnloads.shift();
            if (!chunk) break;
            this.destroyChunk(chunk);
        }
    }

    private chunkKey(cx: number, cy: number): ChunkKey {
        return `${cx},${cy}`;
    }

    private worldToChunkCoord(worldPx: number): number {
        return Math.floor(
            (worldPx + this.config.halfChunkSizePx) / this.config.chunkSizePx
        );
    }

    private enqueueChunkLoad(cx: number, cy: number, key: ChunkKey): void {
        if (this.pendingLoadKeys.has(key)) return;
        this.pendingLoadKeys.add(key);
        this.pendingChunkLoads.push({ cx, cy, key });
    }

    private cancelPendingLoad(key: ChunkKey): void {
        if (this.pendingLoadKeys.has(key)) {
            this.pendingLoadKeys.delete(key);
        }
    }

    private destroyChunk(chunk: ActiveChunk): void {
        const maps = new Set<Phaser.Tilemaps.Tilemap>();

        for (const obj of chunk.objects) {
            const anyObj = obj as any;
            const maybeMap = anyObj?.tilemap as Phaser.Tilemaps.Tilemap | undefined;
            if (maybeMap) maps.add(maybeMap);

            obj.destroy();
        }

        for (const map of maps) map.destroy();

        chunk.objects.length = 0;
    }
}