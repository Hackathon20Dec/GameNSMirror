import { EntityType, TerrainType } from '../world/WorldGenerator';

export const TERRAIN_LAYER_CANDIDATES: Record<TerrainType, string[]> = {
  WATER: ['water', 'ocean', 'river', 'sea'],
  SAND: ['sand', 'beach', 'shore'],
  GRASS: ['grass', 'meadow', 'plains'],
  STONE: ['stone', 'rock', 'mountain'],
};

export const ENTITY_LAYER_CANDIDATES: Record<EntityType, string[]> = {
  CASTLE: ['castle', 'keep', 'fortress'],
  HOUSE: ['house', 'hut', 'home'],
  OUTPOST: ['outpost', 'tower', 'camp'],
  TREE: ['tree', 'forest'],
  ROCK: ['rock', 'boulder'],
  PEBBLE: ['pebble', 'stones'],
  BUSH: ['bush', 'shrub'],
  MUSHROOM: ['mushroom', 'fungus'],
  BONE: ['bone', 'skeleton'],
  RIVER_ROCK: ['river rock', 'water rock'],
};