import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload(): void {
    // Create loading bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 25, 320, 50);

    const loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'Loading...', {
      font: '20px monospace',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    // Update progress bar
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4ade80, 1);
      progressBar.fillRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Try to load assets (will generate fallbacks if they fail)
    this.load.spritesheet('player_male', 'assets/sprites/player_male.png', {
      frameWidth: 32,
      frameHeight: 48,
    });
    this.load.spritesheet('player_female', 'assets/sprites/player_female.png', {
      frameWidth: 32,
      frameHeight: 48,
    });
    this.load.image('tiles', 'assets/tiles/tileset.png');
  }

  create(): void {
    // Generate procedural sprites if assets failed to load
    if (!this.textures.exists('player_male') || this.textures.get('player_male').key === '__MISSING') {
      this.generateCharacterSprite('player_male', 0x4a90d9); // Blue for male
    }
    if (!this.textures.exists('player_female') || this.textures.get('player_female').key === '__MISSING') {
      this.generateCharacterSprite('player_female', 0xe91e8c); // Pink for female
    }
    if (!this.textures.exists('tiles') || this.textures.get('tiles').key === '__MISSING') {
      this.generateTileset();
    }

    // Create player animations
    this.createAnimations('player_male');
    this.createAnimations('player_female');

    this.scene.start(SCENES.TITLE);
  }

  private generateCharacterSprite(key: string, color: number): void {
    // Create a canvas for the spritesheet (4 frames per direction, 4 directions)
    // Layout: Row 0 = down, Row 1 = left, Row 2 = right, Row 3 = up
    const frameWidth = 32;
    const frameHeight = 48;
    const framesPerRow = 4;
    const rows = 4;

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth * framesPerRow;
    canvas.height = frameHeight * rows;
    const ctx = canvas.getContext('2d')!;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each frame
    for (let row = 0; row < rows; row++) {
      for (let frame = 0; frame < framesPerRow; frame++) {
        const x = frame * frameWidth;
        const y = row * frameHeight;

        // Animation offset for walking
        const walkOffset = Math.sin((frame / framesPerRow) * Math.PI * 2) * 2;
        const legOffset = frame % 2 === 0 ? -2 : 2;

        this.drawCharacter(ctx, x, y, frameWidth, frameHeight, color, walkOffset, legOffset, row);
      }
    }

    // Add to Phaser textures using canvas
    const texture = this.textures.addCanvas(key, canvas);
    if (texture) {
      // Add frames manually for spritesheet
      let frameIndex = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < framesPerRow; col++) {
          texture.add(frameIndex, 0, col * frameWidth, row * frameHeight, frameWidth, frameHeight);
          frameIndex++;
        }
      }
    }
  }

  private drawCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    _height: number,
    color: number,
    walkOffset: number,
    legOffset: number,
    direction: number
  ): void {
    const centerX = x + width / 2;

    // Convert hex color to RGB
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const colorStr = `rgb(${r}, ${g}, ${b})`;

    // Body (shirt)
    ctx.fillStyle = colorStr;
    ctx.fillRect(centerX - 8, y + 18 + walkOffset, 16, 16);

    // Arms
    ctx.fillStyle = '#ffdbac'; // Skin tone
    ctx.fillRect(centerX - 12, y + 20 + walkOffset, 4, 12);
    ctx.fillRect(centerX + 8, y + 20 + walkOffset, 4, 12);

    // Legs (pants)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(centerX - 6 + legOffset, y + 34 + walkOffset, 5, 12);
    ctx.fillRect(centerX + 1 - legOffset, y + 34 + walkOffset, 5, 12);

    // Feet
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(centerX - 6 + legOffset, y + 44 + walkOffset, 5, 4);
    ctx.fillRect(centerX + 1 - legOffset, y + 44 + walkOffset, 5, 4);

    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(centerX, y + 12, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = color === 0xe91e8c ? '#8B4513' : '#4a3728';
    if (direction === 0) {
      // Down - show bangs
      ctx.fillRect(centerX - 9, y + 2, 18, 8);
      ctx.fillRect(centerX - 10, y + 4, 4, 6);
      ctx.fillRect(centerX + 6, y + 4, 4, 6);
    } else if (direction === 3) {
      // Up - show back of head
      ctx.fillRect(centerX - 9, y + 2, 18, 14);
    } else {
      // Left/Right - side view
      ctx.fillRect(centerX - 9, y + 2, 18, 10);
    }

    // Eyes (only show when facing down or sides)
    if (direction !== 3) {
      ctx.fillStyle = '#000000';
      if (direction === 0) {
        // Down - both eyes
        ctx.fillRect(centerX - 5, y + 11, 3, 3);
        ctx.fillRect(centerX + 2, y + 11, 3, 3);
      } else if (direction === 1) {
        // Left
        ctx.fillRect(centerX - 6, y + 11, 3, 3);
      } else if (direction === 2) {
        // Right
        ctx.fillRect(centerX + 3, y + 11, 3, 3);
      }
    }
  }

  private generateTileset(): void {
    const tileSize = 32;
    const tilesPerRow = 4;
    const rows = 2;

    const canvas = document.createElement('canvas');
    canvas.width = tileSize * tilesPerRow;
    canvas.height = tileSize * rows;
    const ctx = canvas.getContext('2d')!;

    // Tile 0: Grass
    this.drawGrassTile(ctx, 0, 0, tileSize);

    // Tile 1: Grass variant
    this.drawGrassTile(ctx, tileSize, 0, tileSize, true);

    // Tile 2: Tree
    this.drawTreeTile(ctx, tileSize * 2, 0, tileSize);

    // Tile 3: Rock
    this.drawRockTile(ctx, tileSize * 3, 0, tileSize);

    // Tile 4: Water
    this.drawWaterTile(ctx, 0, tileSize, tileSize);

    // Tile 5: Sand
    this.drawSandTile(ctx, tileSize, tileSize, tileSize);

    // Tile 6: Dirt
    this.drawDirtTile(ctx, tileSize * 2, tileSize, tileSize);

    // Tile 7: Fence
    this.drawFenceTile(ctx, tileSize * 3, tileSize, tileSize);

    this.textures.addCanvas('tiles', canvas);
  }

  private drawGrassTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, variant = false): void {
    ctx.fillStyle = variant ? '#3d8c40' : '#4ade4a';
    ctx.fillRect(x, y, size, size);

    // Add grass blades
    ctx.fillStyle = variant ? '#2d6a30' : '#3abd3a';
    for (let i = 0; i < 8; i++) {
      const bx = x + Math.random() * size;
      const by = y + Math.random() * size;
      ctx.fillRect(bx, by, 2, 4);
    }
  }

  private drawTreeTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // Grass background
    this.drawGrassTile(ctx, x, y, size);

    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + size / 2 - 3, y + size / 2, 6, size / 2);

    // Foliage
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 3, size / 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a6b1a';
    ctx.beginPath();
    ctx.arc(x + size / 2 - 4, y + size / 3 + 2, size / 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRockTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // Grass background
    this.drawGrassTile(ctx, x, y, size);

    // Rock
    ctx.fillStyle = '#808080';
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size / 2 + 4, size / 3, size / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.ellipse(x + size / 2 - 2, y + size / 2 + 2, size / 4, size / 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawWaterTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = '#6ab0f9';
    ctx.fillRect(x + 4, y + 8, 8, 2);
    ctx.fillRect(x + 16, y + 20, 10, 2);
  }

  private drawSandTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = '#e6d5a8';
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = '#d4c496';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + Math.random() * size, y + Math.random() * size, 3, 3);
    }
  }

  private drawDirtTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = '#7a6348';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(x + Math.random() * size, y + Math.random() * size, 4, 4);
    }
  }

  private drawFenceTile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // Grass background
    this.drawGrassTile(ctx, x, y, size);

    // Fence posts
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 4, y + 8, 4, 20);
    ctx.fillRect(x + size - 8, y + 8, 4, 20);

    // Fence rails
    ctx.fillRect(x, y + 12, size, 3);
    ctx.fillRect(x, y + 22, size, 3);
  }

  private createAnimations(spriteKey: string): void {
    // Walk down
    this.anims.create({
      key: `${spriteKey}_walk_down`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    // Walk left
    this.anims.create({
      key: `${spriteKey}_walk_left`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    // Walk right
    this.anims.create({
      key: `${spriteKey}_walk_right`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });

    // Walk up
    this.anims.create({
      key: `${spriteKey}_walk_up`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1,
    });

    // Idle animations (single frame)
    this.anims.create({
      key: `${spriteKey}_idle_down`,
      frames: [{ key: spriteKey, frame: 0 }],
      frameRate: 1,
    });

    this.anims.create({
      key: `${spriteKey}_idle_left`,
      frames: [{ key: spriteKey, frame: 4 }],
      frameRate: 1,
    });

    this.anims.create({
      key: `${spriteKey}_idle_right`,
      frames: [{ key: spriteKey, frame: 8 }],
      frameRate: 1,
    });

    this.anims.create({
      key: `${spriteKey}_idle_up`,
      frames: [{ key: spriteKey, frame: 12 }],
      frameRate: 1,
    });
  }
}
