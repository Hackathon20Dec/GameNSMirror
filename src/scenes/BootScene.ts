import Phaser from 'phaser';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const MIN_LOADING_TIME = 4000; // 4 seconds loading bar

export default class BootScene extends Phaser.Scene {
  private loadingStartTime: number = 0;
  private assetsLoaded: boolean = false;
  private bg: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.loadingStartTime = Date.now();

    // Set background color matching the loading screen sky
    this.cameras.main.setBackgroundColor('#5ba3d0');

    // Load the loading screen image first
    this.load.image('loading_bg', 'assets/loading_screen.png');

    this.load.on('complete', () => {
      this.assetsLoaded = true;
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

    // Load player character skins (10 male + 10 female)
    // 4x4 spritesheets: 512x512 total, 128x128 per frame
    for (let i = 1; i <= 10; i++) {
      const num = String(i).padStart(2, '0');
      this.load.spritesheet(`guest_male_${num}`, `assets/PlayCharacters/guest_male_${num}_preview.png`, {
        frameWidth: 128,
        frameHeight: 128,
      });
      this.load.spritesheet(`guest_female_${num}`, `assets/PlayCharacters/guest_female_${num}_preview.png`, {
        frameWidth: 128,
        frameHeight: 128,
      });
    }
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    // Show loading background image - fill the entire screen
    if (this.textures.exists('loading_bg')) {
      this.bg = this.add.image(width / 2, height / 2, 'loading_bg');
      this.fitBackground();
      this.bg.setDepth(-1);
    }

    // Handle window resize
    this.scale.on('resize', this.handleResize, this);

    // Create single loading bar
    const barX = width / 2;
    const barY = height - 80;
    const barWidth = 280;
    const barHeight = 20;

    // Loading text
    const loadingLabel = this.add.text(barX, barY - 35, 'LOADING...', {
      font: 'bold 16px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    loadingLabel.setOrigin(0.5);

    // Progress bar background
    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x5c2e2e, 1);
    progressBg.fillRoundedRect(barX - barWidth / 2, barY, barWidth, barHeight, 5);
    progressBg.lineStyle(3, 0x000000, 0.6);
    progressBg.strokeRoundedRect(barX - barWidth / 2, barY, barWidth, barHeight, 5);

    // Progress bar fill
    const progressFill = this.add.graphics();

    // Calculate loading time
    const elapsed = Date.now() - this.loadingStartTime;
    const remainingTime = Math.max(1000, MIN_LOADING_TIME - elapsed);

    // Animate progress bar fill
    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: remainingTime,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const value = (tween.getValue() ?? 0) / 100;
        progressFill.clear();
        progressFill.fillStyle(0xcd5c5c, 1);
        const fillWidth = (barWidth - 6) * value;
        if (fillWidth > 0) {
          progressFill.fillRoundedRect(barX - barWidth / 2 + 3, barY + 3, fillWidth, barHeight - 6, 3);
        }
      },
      onComplete: () => {
        // Hide loading bar elements
        loadingLabel.destroy();
        progressBg.destroy();
        progressFill.destroy();

        // Show ENTER button with floating effect
        this.showEnterButton(barX, barY);
      }
    });

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

    // Create player skin animations (same layout as NPCs)
    for (let i = 1; i <= 10; i++) {
      const num = String(i).padStart(2, '0');
      this.createNPCAnimations(`guest_male_${num}`);
      this.createNPCAnimations(`guest_female_${num}`);
    }

    // Note: Scene transition is handled by the ENTER button
  }

  private fitBackground(): void {
    if (!this.bg) return;
    const width = this.scale.width;
    const height = this.scale.height;

    // Scale to cover the entire screen while maintaining aspect ratio
    const scaleX = width / this.bg.width;
    const scaleY = height / this.bg.height;
    const scale = Math.max(scaleX, scaleY);

    this.bg.setScale(scale);
    this.bg.setPosition(width / 2, height / 2);
  }

  private handleResize(): void {
    this.fitBackground();
  }

  private showEnterButton(x: number, y: number): void {
    // Create button container
    const buttonBg = this.add.graphics();
    const buttonWidth = 180;
    const buttonHeight = 50;

    // Draw button background
    buttonBg.fillStyle(0x2d5a27, 1);
    buttonBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 10);
    buttonBg.lineStyle(3, 0x1a3518, 1);
    buttonBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 10);

    // Button text
    const buttonText = this.add.text(x, y, 'ENTER', {
      font: 'bold 24px Georgia, serif',
      color: '#ffffff',
      stroke: '#1a3518',
      strokeThickness: 2,
    });
    buttonText.setOrigin(0.5);

    // Create invisible interactive zone
    const hitArea = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    // Floating animation
    this.tweens.add({
      targets: [buttonBg, buttonText],
      y: '-=8',
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Sync hit area with floating
    this.tweens.add({
      targets: hitArea,
      y: y - 8,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Hover effects
    hitArea.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x3a7233, 1);
      buttonBg.fillRoundedRect(x - buttonWidth / 2, buttonBg.y - buttonHeight / 2, buttonWidth, buttonHeight, 10);
      buttonBg.lineStyle(3, 0x2d5a27, 1);
      buttonBg.strokeRoundedRect(x - buttonWidth / 2, buttonBg.y - buttonHeight / 2, buttonWidth, buttonHeight, 10);
    });

    hitArea.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x2d5a27, 1);
      buttonBg.fillRoundedRect(x - buttonWidth / 2, buttonBg.y - buttonHeight / 2, buttonWidth, buttonHeight, 10);
      buttonBg.lineStyle(3, 0x1a3518, 1);
      buttonBg.strokeRoundedRect(x - buttonWidth / 2, buttonBg.y - buttonHeight / 2, buttonWidth, buttonHeight, 10);
    });

    // Click to enter
    hitArea.on('pointerdown', () => {
      // Fade out and transition
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('TitleScene');
      });
    });
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
