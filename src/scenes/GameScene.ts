import Phaser from 'phaser';
import { SCENES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { Player } from '../entities/Player';
import { OtherPlayer } from '../entities/OtherPlayer';
import { PlayerData, PlayerState } from '../types';
import { MultiplayerManager } from '../lib/multiplayer';

interface ChatMessage {
  name: string;
  text: string;
  color: string;
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private obstaclesLayer!: Phaser.Tilemaps.TilemapLayer;
  private multiplayer!: MultiplayerManager;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private playerCount!: Phaser.GameObjects.Text;
  private chatMessages: ChatMessage[] = [];
  private chatContainer!: Phaser.GameObjects.Container;
  private chatInput!: HTMLInputElement;
  private playerColors: Map<string, string> = new Map();
  private myColor!: string;
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private joystickPointer: Phaser.Input.Pointer | null = null;
  private isMobile: boolean = false;

  constructor() {
    super({ key: SCENES.GAME });
  }

  init(data: { player: PlayerData }): void {
    this.data.set('playerData', data.player);
  }

  async create(): Promise<void> {
    const playerData = this.data.get('playerData') as PlayerData;

    // Create tilemap
    this.createMap();

    // Create player at center of map
    const startX = (MAP_WIDTH * TILE_SIZE) / 2;
    const startY = (MAP_HEIGHT * TILE_SIZE) / 2;
    this.player = new Player(this, startX, startY, playerData.name, playerData.gender);

    // Set up collision with obstacles
    if (this.obstaclesLayer) {
      this.physics.add.collider(this.player, this.obstaclesLayer);
    }

    // Set up camera
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.physics.world.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    // Add player name tag
    this.createNameTag(playerData.name);

    // Display welcome message
    this.showWelcomeMessage(playerData.name);

    // Player count display
    this.playerCount = this.add.text(GAME_WIDTH - 20, 20, 'Players: 1', {
      font: 'bold 16px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.playerCount.setOrigin(1, 0);
    this.playerCount.setScrollFactor(0);

    // Generate my color
    this.myColor = this.generateColor(playerData.name);

    // Check if mobile
    this.isMobile = this.checkMobile();

    // Create chat UI
    this.createChatUI();

    // Create mobile controls if on mobile
    if (this.isMobile) {
      this.createMobileControls();
    }

    // Initialize multiplayer
    await this.initMultiplayer(playerData, startX, startY);
  }

  private checkMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 2);
  }

  private createMobileControls(): void {
    const joystickX = 80;
    const joystickY = GAME_HEIGHT - 100;
    const baseRadius = 50;
    const thumbRadius = 25;

    // Joystick base
    this.joystickBase = this.add.circle(joystickX, joystickY, baseRadius, 0x000000, 0.4);
    this.joystickBase.setStrokeStyle(2, 0x4ade80, 0.6);
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(999);

    // Joystick thumb
    this.joystickThumb = this.add.circle(joystickX, joystickY, thumbRadius, 0x4ade80, 0.6);
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(1000);

    // Chat button for mobile
    const chatBtn = this.add.circle(GAME_WIDTH - 50, GAME_HEIGHT - 100, 30, 0x4ade80, 0.7);
    chatBtn.setStrokeStyle(2, 0xffffff, 0.5);
    chatBtn.setScrollFactor(0);
    chatBtn.setDepth(999);
    chatBtn.setInteractive();

    const chatIcon = this.add.text(GAME_WIDTH - 50, GAME_HEIGHT - 100, '💬', {
      font: '24px Arial',
    });
    chatIcon.setOrigin(0.5);
    chatIcon.setScrollFactor(0);
    chatIcon.setDepth(1000);

    chatBtn.on('pointerdown', () => {
      this.chatInput.style.display = 'block';
      this.chatInput.focus();
    });

    // Touch input handling
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check if touch is in joystick area (left half of screen, bottom)
      if (pointer.x < GAME_WIDTH / 2 && pointer.y > GAME_HEIGHT / 2) {
        this.joystickPointer = pointer;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
        this.updateJoystick(pointer);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
        this.resetJoystick();
      }
    });
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const joystickX = 80;
    const joystickY = GAME_HEIGHT - 100;
    const maxDistance = 40;

    // Calculate distance from center
    const dx = pointer.x - joystickX;
    const dy = pointer.y - joystickY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize and clamp
    let nx = dx;
    let ny = dy;

    if (distance > maxDistance) {
      nx = (dx / distance) * maxDistance;
      ny = (dy / distance) * maxDistance;
    }

    // Update thumb position
    this.joystickThumb.setPosition(joystickX + nx, joystickY + ny);

    // Set player joystick values (-1 to 1)
    this.player.joystickX = nx / maxDistance;
    this.player.joystickY = ny / maxDistance;
  }

  private resetJoystick(): void {
    const joystickX = 80;
    const joystickY = GAME_HEIGHT - 100;

    this.joystickThumb.setPosition(joystickX, joystickY);
    this.joystickPointer = null;
    this.player.joystickX = 0;
    this.player.joystickY = 0;
  }

  private generateColor(name: string): string {
    // Generate a unique bright color based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate HSL color with high saturation and lightness for visibility
    const h = Math.abs(hash) % 360;
    const s = 70 + (Math.abs(hash >> 8) % 20); // 70-90%
    const l = 55 + (Math.abs(hash >> 16) % 15); // 55-70%

    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  private getPlayerColor(name: string): string {
    if (!this.playerColors.has(name)) {
      this.playerColors.set(name, this.generateColor(name));
    }
    return this.playerColors.get(name)!;
  }

  private createChatUI(): void {
    // Chat container background
    this.chatContainer = this.add.container(10, 10);
    this.chatContainer.setScrollFactor(0);
    this.chatContainer.setDepth(1000);

    // Semi-transparent background
    const chatBg = this.add.rectangle(0, 0, 280, 150, 0x000000, 0.5);
    chatBg.setOrigin(0, 0);
    chatBg.setStrokeStyle(1, 0x444444);
    this.chatContainer.add(chatBg);

    // Chat title
    const title = this.add.text(10, 5, 'Chat', {
      font: 'bold 12px Arial',
      color: '#888888',
    });
    this.chatContainer.add(title);

    // Create chat input
    this.createChatInput();

    // Instructions (only on desktop)
    if (!this.isMobile) {
      const instructions = this.add.text(10, GAME_HEIGHT - 25, 'Press Enter to chat', {
        font: '12px Arial',
        color: '#666666',
      });
      instructions.setScrollFactor(0);
    }
  }

  private createChatInput(): void {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;

    this.chatInput = document.createElement('input');
    this.chatInput.type = 'text';
    this.chatInput.placeholder = 'Type message...';
    this.chatInput.maxLength = 100;
    this.chatInput.style.cssText = `
      position: absolute;
      width: 260px;
      padding: 6px 10px;
      font-size: 12px;
      border: 1px solid #4ade80;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.8);
      color: #ffffff;
      outline: none;
      display: none;
    `;

    this.chatInput.style.left = `${rect.left + 10 * scaleX}px`;
    this.chatInput.style.top = `${rect.top + 165 * scaleY}px`;

    document.body.appendChild(this.chatInput);

    // Handle enter key
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.chatInput.value.trim()) {
        this.sendChatMessage(this.chatInput.value.trim());
        this.chatInput.value = '';
        this.chatInput.style.display = 'none';
        this.game.canvas.focus();
      } else if (e.key === 'Escape') {
        this.chatInput.value = '';
        this.chatInput.style.display = 'none';
        this.game.canvas.focus();
      }
    });

    // Prevent game input while typing
    this.chatInput.addEventListener('focus', () => {
      if (this.input.keyboard) {
        this.input.keyboard.enabled = false;
      }
    });

    this.chatInput.addEventListener('blur', () => {
      if (this.input.keyboard) {
        this.input.keyboard.enabled = true;
      }
    });

    // Listen for Enter key to open chat
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.chatInput.style.display === 'none') {
        this.chatInput.style.display = 'block';
        this.chatInput.focus();
      }
    });
  }

  private sendChatMessage(text: string): void {
    if (this.multiplayer) {
      this.multiplayer.sendChat(text);
      // Add our own message locally
      this.addChatMessage(this.player.playerName, text, this.myColor);
    }
  }

  private addChatMessage(name: string, text: string, color: string): void {
    this.chatMessages.push({ name, text, color });

    // Keep only last 5 messages
    if (this.chatMessages.length > 5) {
      this.chatMessages.shift();
    }

    this.renderChatMessages();
  }

  private renderChatMessages(): void {
    // Remove old message texts
    this.chatContainer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData('isMessage')) {
        child.destroy();
      }
    });

    // Render messages
    this.chatMessages.forEach((msg, i) => {
      const y = 22 + i * 24;

      // Name with color
      const nameText = this.add.text(10, y, `${msg.name}:`, {
        font: 'bold 11px Arial',
        color: msg.color,
      });
      nameText.setData('isMessage', true);
      this.chatContainer.add(nameText);

      // Message text
      const msgText = this.add.text(15 + nameText.width, y, ` ${msg.text}`, {
        font: '11px Arial',
        color: '#ffffff',
        wordWrap: { width: 250 - nameText.width },
      });
      msgText.setData('isMessage', true);
      this.chatContainer.add(msgText);
    });
  }

  private async initMultiplayer(playerData: PlayerData, startX: number, startY: number): Promise<void> {
    try {
      const oderId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.multiplayer = new MultiplayerManager(
        oderId,
        playerData.name,
        playerData.gender,
        startX,
        startY
      );

      this.multiplayer.onJoin((playerState: PlayerState) => {
        this.addOtherPlayer(playerState);
        this.updatePlayerCount();
      });

      this.multiplayer.onLeave((oderId: string) => {
        this.removeOtherPlayer(oderId);
        this.updatePlayerCount();
      });

      this.multiplayer.onMove((playerState: PlayerState) => {
        this.updateOtherPlayer(playerState);
      });

      this.multiplayer.onChatMessage((_playerId: string, name: string, text: string) => {
        const color = this.getPlayerColor(name);
        this.addChatMessage(name, text, color);
      });

      await this.multiplayer.connect();
    } catch (error) {
      console.error('Failed to connect to multiplayer:', error);
    }
  }

  private addOtherPlayer(playerState: PlayerState): void {
    if (this.otherPlayers.has(playerState.id)) return;

    const otherPlayer = new OtherPlayer(
      this,
      playerState.x,
      playerState.y,
      playerState.id,
      playerState.name,
      playerState.gender
    );

    this.otherPlayers.set(playerState.id, otherPlayer);
  }

  private removeOtherPlayer(oderId: string): void {
    const otherPlayer = this.otherPlayers.get(oderId);
    if (otherPlayer) {
      otherPlayer.destroy();
      this.otherPlayers.delete(oderId);
    }
  }

  private updateOtherPlayer(playerState: PlayerState): void {
    let otherPlayer = this.otherPlayers.get(playerState.id);

    if (!otherPlayer) {
      this.addOtherPlayer(playerState);
      otherPlayer = this.otherPlayers.get(playerState.id);
    }

    if (otherPlayer) {
      otherPlayer.updatePosition(
        playerState.x,
        playerState.y,
        playerState.direction,
        playerState.isMoving
      );
    }
  }

  private updatePlayerCount(): void {
    const count = this.otherPlayers.size + 1;
    this.playerCount.setText(`Players: ${count}`);
  }

  private createMap(): void {
    this.map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
    });

    const tileset = this.map.addTilesetImage('tiles', 'tiles', TILE_SIZE, TILE_SIZE, 0, 0);

    if (!tileset) {
      this.createProceduralMap();
      return;
    }

    this.groundLayer = this.map.createBlankLayer('ground', tileset, 0, 0)!;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const tileIndex = Math.random() > 0.9 ? 1 : 0;
        this.groundLayer.putTileAt(tileIndex, x, y);
      }
    }

    this.obstaclesLayer = this.map.createBlankLayer('obstacles', tileset, 0, 0)!;
    this.addObstacles();
  }

  private createProceduralMap(): void {
    const graphics = this.add.graphics();

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const shade = 0.9 + Math.random() * 0.2;
        const green = Math.floor(90 * shade);
        const color = Phaser.Display.Color.GetColor(45, green + 50, 39);
        graphics.fillStyle(color);
        graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    const obstacleGroup = this.physics.add.staticGroup();

    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(2, MAP_WIDTH - 3) * TILE_SIZE + TILE_SIZE / 2;
      const y = Phaser.Math.Between(2, MAP_HEIGHT - 3) * TILE_SIZE + TILE_SIZE / 2;

      const centerX = (MAP_WIDTH * TILE_SIZE) / 2;
      const centerY = (MAP_HEIGHT * TILE_SIZE) / 2;
      if (Math.abs(x - centerX) < TILE_SIZE * 3 && Math.abs(y - centerY) < TILE_SIZE * 3) {
        continue;
      }

      graphics.fillStyle(0x8B4513);
      graphics.fillRect(x - 4, y, 8, 16);
      graphics.fillStyle(0x228B22);
      graphics.fillCircle(x, y - 8, 20);

      const obstacle = obstacleGroup.create(x, y + 8, undefined) as Phaser.Physics.Arcade.Sprite;
      obstacle.setVisible(false);
      obstacle.body?.setSize(24, 16);
    }

    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(2, MAP_WIDTH - 3) * TILE_SIZE + TILE_SIZE / 2;
      const y = Phaser.Math.Between(2, MAP_HEIGHT - 3) * TILE_SIZE + TILE_SIZE / 2;

      const centerX = (MAP_WIDTH * TILE_SIZE) / 2;
      const centerY = (MAP_HEIGHT * TILE_SIZE) / 2;
      if (Math.abs(x - centerX) < TILE_SIZE * 3 && Math.abs(y - centerY) < TILE_SIZE * 3) {
        continue;
      }

      graphics.fillStyle(0x808080);
      graphics.fillEllipse(x, y, 24, 16);
      graphics.fillStyle(0x696969);
      graphics.fillEllipse(x - 2, y - 2, 20, 12);

      const obstacle = obstacleGroup.create(x, y, undefined) as Phaser.Physics.Arcade.Sprite;
      obstacle.setVisible(false);
      obstacle.body?.setSize(24, 16);
    }

    graphics.fillStyle(0x8B4513);
    for (let x = 0; x < MAP_WIDTH; x++) {
      graphics.fillRect(x * TILE_SIZE, 0, TILE_SIZE, 8);
      graphics.fillRect(x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE - 8, TILE_SIZE, 8);

      const topFence = obstacleGroup.create(x * TILE_SIZE + TILE_SIZE / 2, 4, undefined) as Phaser.Physics.Arcade.Sprite;
      topFence.setVisible(false);
      topFence.body?.setSize(TILE_SIZE, 8);

      const bottomFence = obstacleGroup.create(x * TILE_SIZE + TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 4, undefined) as Phaser.Physics.Arcade.Sprite;
      bottomFence.setVisible(false);
      bottomFence.body?.setSize(TILE_SIZE, 8);
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      graphics.fillRect(0, y * TILE_SIZE, 8, TILE_SIZE);
      graphics.fillRect(MAP_WIDTH * TILE_SIZE - 8, y * TILE_SIZE, 8, TILE_SIZE);

      const leftFence = obstacleGroup.create(4, y * TILE_SIZE + TILE_SIZE / 2, undefined) as Phaser.Physics.Arcade.Sprite;
      leftFence.setVisible(false);
      leftFence.body?.setSize(8, TILE_SIZE);

      const rightFence = obstacleGroup.create(MAP_WIDTH * TILE_SIZE - 4, y * TILE_SIZE + TILE_SIZE / 2, undefined) as Phaser.Physics.Arcade.Sprite;
      rightFence.setVisible(false);
      rightFence.body?.setSize(8, TILE_SIZE);
    }

    this.physics.add.collider(this.player, obstacleGroup);
  }

  private addObstacles(): void {
    const treePositions = [
      { x: 5, y: 5 }, { x: 10, y: 3 }, { x: 15, y: 8 },
      { x: 25, y: 5 }, { x: 30, y: 10 }, { x: 8, y: 20 },
      { x: 35, y: 25 }, { x: 5, y: 25 }, { x: 20, y: 28 },
    ];

    for (const pos of treePositions) {
      const tile = this.obstaclesLayer.putTileAt(2, pos.x, pos.y);
      if (tile) tile.setCollision(true);
    }

    this.obstaclesLayer.setCollisionByExclusion([-1]);
  }

  private createNameTag(name: string): void {
    const nameTag = this.add.text(0, -40, name, {
      font: 'bold 14px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    nameTag.setOrigin(0.5);

    this.events.on('update', () => {
      nameTag.setPosition(this.player.x, this.player.y - 40);
    });
  }

  private showWelcomeMessage(name: string): void {
    const welcomeText = this.add.text(GAME_WIDTH / 2, 50, `Welcome, ${name}!`, {
      font: 'bold 24px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    welcomeText.setOrigin(0.5);
    welcomeText.setScrollFactor(0);

    const controlsText = this.add.text(GAME_WIDTH / 2, 85, 'Use WASD or Arrow Keys to move', {
      font: '16px Arial',
      color: '#e0e0e0',
      stroke: '#000000',
      strokeThickness: 2,
    });
    controlsText.setOrigin(0.5);
    controlsText.setScrollFactor(0);

    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [welcomeText, controlsText],
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          welcomeText.destroy();
          controlsText.destroy();
        },
      });
    });
  }

  update(): void {
    this.player.update();

    // Broadcast position
    if (this.multiplayer) {
      this.multiplayer.broadcastPosition(
        this.player.x,
        this.player.y,
        this.player.currentDirection,
        this.player.isMoving
      );
    }

    // Update other players
    this.otherPlayers.forEach((otherPlayer) => {
      otherPlayer.update();
    });
  }

  shutdown(): void {
    if (this.multiplayer) {
      this.multiplayer.disconnect();
    }
    if (this.chatInput?.parentNode) {
      this.chatInput.remove();
    }
  }
}
