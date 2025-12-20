export const TILE_SIZE = 32;

// Source spritesheet tiles are 64x64px (we render them scaled down to TILE_SIZE).
export const SPRITESHEET_FRAME_SIZE = 64;
export const SPRITESHEET_SCALE = TILE_SIZE / SPRITESHEET_FRAME_SIZE;

export const CHUNK_SIZE_TILES = 32;
export const CHUNK_SIZE_PX = TILE_SIZE * CHUNK_SIZE_TILES; // 1024px
export const HALF_CHUNK_SIZE_PX = CHUNK_SIZE_PX / 2; // 512px
export const HALF_CHUNK_SIZE_TILES = CHUNK_SIZE_TILES / 2; // 16 tiles

export const PLAYER_SPEED_PX_PER_SEC = 200;

// A pragmatic emoji-capable font stack across platforms (used by HUD text).
export const EMOJI_FONT_FAMILY =
  'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';