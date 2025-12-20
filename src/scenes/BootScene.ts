import Phaser from 'phaser';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
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

    // Load AI NPC sprites as spritesheets (4x4 grid, 128x128 per frame)
    this.load.spritesheet('npc_balaji', 'assets/sprites/balaji_suit_preview.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet('npc_jackson', 'assets/sprites/jackson_preview.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet('npc_otavio', 'assets/sprites/otavio_preview.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet('npc_yash', 'assets/sprites/yash_preview.png', {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create(): void {
    // Generate procedural sprites if assets failed to load
    if (!this.textures.exists('player_male') || this.textures.get('player_male').key === '__MISSING') {
      this.generateCharacterSprite('player_male', 0x4a90d9); // Blue for male
    }
    if (!this.textures.exists('player_female') || this.textures.get('player_female').key === '__MISSING') {
      this.generateCharacterSprite('player_female', 0xe91e8c); // Pink for female
    }

    // Create player animations
    this.createAnimations('player_male');
    this.createAnimations('player_female');

    // Create NPC animations (same 4x4 layout: down, left, right, up)
    this.createNPCAnimations('npc_balaji');
    this.createNPCAnimations('npc_jackson');
    this.createNPCAnimations('npc_otavio');
    this.createNPCAnimations('npc_yash');

    this.scene.start('TitleScene');
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

  private createNPCAnimations(spriteKey: string): void {
    // NPC spritesheets: 4x4 grid (4 columns = frames, 4 rows = directions)
    // Row 0 (frames 0-3): Down
    // Row 1 (frames 4-7): Left
    // Row 2 (frames 8-11): Right
    // Row 3 (frames 12-15): Up

    // Idle animations (first frame of each direction)
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

    // Walk animations
    this.anims.create({
      key: `${spriteKey}_walk_down`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: `${spriteKey}_walk_left`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: `${spriteKey}_walk_right`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: `${spriteKey}_walk_up`,
      frames: this.anims.generateFrameNumbers(spriteKey, { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1,
    });
  }
}
