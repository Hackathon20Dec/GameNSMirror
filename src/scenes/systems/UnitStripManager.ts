import Phaser from "phaser";
import { SPRITESHEET_FRAME_SIZE, SPRITESHEET_SCALE } from "../../constants";

export interface UnitTextureMeta {
    frameSize: number;
    frameCount: number;
    scale: number;
    horizontal: boolean;
}

/**
    * Handles:
    * - Setting NEAREST filtering for pixel art textures
    * - Splitting "strip" images into frames f0..fN-1
    * - Creating Phaser animations for those frames
    *
    * Scale strategy:
    * - World tiles are 64px source frames rendered at TILE_SIZE via SPRITESHEET_SCALE.
    * - Unit frames vary (usually 64px). We normalize them to the 64px reference,
    *   then apply SPRITESHEET_SCALE so units visually match the world.
    */
export default class UnitStripManager {
    private readonly scene: Phaser.Scene;
    private readonly unitMetaByTextureKey = new Map<string, UnitTextureMeta>();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public setNearestFilterForTexture(textureKey: string): void {
        if (!this.scene.textures.exists(textureKey)) return;
        this.scene.textures
            .get(textureKey)
            .setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    /**
        * Treats a unit sheet as either:
        * - horizontal strip (width >= height): frames are height x height
        * - vertical strip (width < height): frames are width x width
        *
        * Adds frames named f0..fN-1 to that texture.
        */
    public ensureStripFrames(textureKey: string): UnitTextureMeta | null {
        const cached = this.unitMetaByTextureKey.get(textureKey);
        if (cached) return cached;

        if (!this.scene.textures.exists(textureKey)) return null;
        const tex = this.scene.textures.get(textureKey);

        const src = tex.getSourceImage() as any;
        const width = Number(src?.width ?? 0);
        const height = Number(src?.height ?? 0);

        if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return null;
        }

        const horizontal = width >= height;
        const frameSize = horizontal ? height : width;
        if (!Number.isFinite(frameSize) || frameSize <= 0) return null;

        const frameCount = Math.floor((horizontal ? width : height) / frameSize);
        if (!Number.isFinite(frameCount) || frameCount <= 0) return null;

        // Texture typings don’t expose frames map cleanly, but it exists at runtime.
        const frames = (tex as any).frames as Record<string, unknown> | undefined;

        for (let i = 0; i < frameCount; i++) {
            const frameName = `f${i}`;
            const already = frames
                ? Object.prototype.hasOwnProperty.call(frames, frameName)
                : false;
            if (already) continue;

            const x = horizontal ? i * frameSize : 0;
            const y = horizontal ? 0 : i * frameSize;

            tex.add(frameName, 0, x, y, frameSize, frameSize);
        }

        const scale = (SPRITESHEET_FRAME_SIZE / frameSize) * SPRITESHEET_SCALE;

        const meta: UnitTextureMeta = { frameSize, frameCount, scale, horizontal };
        this.unitMetaByTextureKey.set(textureKey, meta);
        return meta;
    }

    public ensureStripAnimation(
        animKey: string,
        textureKey: string,
        frameRate: number,
        repeat: number
    ): void {
        if (this.scene.anims.exists(animKey)) return;

        const meta = this.ensureStripFrames(textureKey);
        if (!meta) return;

        const frames: Phaser.Types.Animations.AnimationFrame[] = [];
        for (let i = 0; i < meta.frameCount; i++) {
            frames.push({ key: textureKey, frame: `f${i}` });
        }

        this.scene.anims.create({
            key: animKey,
            frames,
            frameRate,
            repeat,
        });
    }
}