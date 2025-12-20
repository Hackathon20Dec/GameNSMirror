import Phaser from 'phaser';

export interface TilesetTile {
  x: number;
  y: number;
  spriteSheetId: string;
  scaleX?: number;
  scaleY?: number;
  id?: string;
}

export interface TilesetLayer {
  name: string;
  tiles: TilesetTile[];
  defaultTile?: TilesetTile;
  rules?: unknown;
}

export interface TilesetManifest {
  tileSize: number;
  spriteSheets: Record<string, string>;
  layers: TilesetLayer[];
}

export interface FrameRef {
  textureKey: string;
  frame: string;
}

export class TilesetManager {
  private layersByNameLower: Map<string, TilesetLayer> = new Map();
  private layerNames: string[] = [];

  constructor(private manifest: TilesetManifest) {
    for (const layer of manifest.layers) {
      this.layersByNameLower.set(layer.name.toLowerCase(), layer);
      this.layerNames.push(layer.name);
    }
  }

  public static sheetTextureKey(spriteSheetId: string): string {
    return `sheet_${spriteSheetId}`;
  }

  public getTileSize(): number {
    return this.manifest.tileSize;
  }

  public getLayerNames(): string[] {
    return [...this.layerNames];
  }

  public getLayerByName(layerName: string): TilesetLayer | null {
    return this.layersByNameLower.get(layerName.toLowerCase()) ?? null;
  }

  public findFirstExistingLayerName(candidates: string[]): string | null {
    const lowers = candidates.map((c) => c.toLowerCase());

    // 1) Exact (case-insensitive)
    for (const c of lowers) {
      for (const name of this.layerNames) {
        if (name.toLowerCase() === c) return name;
      }
    }

    // 2) Substring match
    const all = this.layerNames.map((n) => ({ name: n, lower: n.toLowerCase() }));
    for (const c of lowers) {
      const found = all.find((n) => n.lower.includes(c));
      if (found) return found.name;
    }

    return null;
  }

  public toFrameRef(tile: TilesetTile): FrameRef {
    const textureKey = TilesetManager.sheetTextureKey(tile.spriteSheetId);
    const frame = `${tile.x}_${tile.y}`;
    return { textureKey, frame };
  }

  private resolveDefaultTile(layer: TilesetLayer): TilesetTile | null {
    if (layer.defaultTile) return layer.defaultTile;
    if (layer.tiles.length > 0) return layer.tiles[0]!;
    return null;
  }

  public getDefaultFrameForLayer(layerName: string): FrameRef | null {
    const layer = this.getLayerByName(layerName);
    if (!layer) return null;

    const t = this.resolveDefaultTile(layer);
    if (!t) return null;

    return this.toFrameRef(t);
  }

  public getDefaultFrameByCandidates(candidates: string[]): FrameRef | null {
    const name = this.findFirstExistingLayerName(candidates);
    if (!name) return null;
    return this.getDefaultFrameForLayer(name);
  }

  public getRandomFrameForLayer(layerName: string, roll01: number): FrameRef | null {
    const layer = this.getLayerByName(layerName);
    if (!layer) return null;
    if (!layer.tiles || layer.tiles.length <= 0) return null;

    const idx = Math.floor(roll01 * layer.tiles.length) % layer.tiles.length;
    return this.toFrameRef(layer.tiles[idx] ?? layer.tiles[0]!);
  }

  public getRandomFrameByCandidates(candidates: string[], roll01: number): FrameRef | null {
    const name = this.findFirstExistingLayerName(candidates);
    if (!name) return null;
    return this.getRandomFrameForLayer(name, roll01);
  }

  public registerAllFrames(scene: Phaser.Scene): void {
    const tileSize = this.manifest.tileSize;

    for (const layer of this.manifest.layers) {
      for (const tile of layer.tiles) {
        this.registerTileFrame(scene, tile, tileSize);
      }
      const def = this.resolveDefaultTile(layer);
      if (def) this.registerTileFrame(scene, def, tileSize);
    }
  }

  private registerTileFrame(scene: Phaser.Scene, tile: TilesetTile, tileSize: number): void {
    const textureKey = TilesetManager.sheetTextureKey(tile.spriteSheetId);
    if (!scene.textures.exists(textureKey)) return;

    const tex = scene.textures.get(textureKey);
    const frameName = `${tile.x}_${tile.y}`;
    if (tex.has(frameName)) return;

    tex.add(frameName, 0, tile.x, tile.y, tileSize, tileSize);
  }
}