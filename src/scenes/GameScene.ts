import Phaser from 'phaser';
import { SCENES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, GAME_WIDTH } from '../config/constants';
import { Player } from '../entities/Player';
import { OtherPlayer } from '../entities/OtherPlayer';
import { PlayerData, PlayerState } from '../types';
import { MultiplayerManager } from '../lib/multiplayer';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private obstaclesLayer!: Phaser.Tilemaps.TilemapLayer;
  private multiplayer!: MultiplayerManager;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private playerCount!: Phaser.GameObjects.Text;

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

    // Initialize multiplayer
    await this.initMultiplayer(playerData, startX, startY);
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
  }
}
