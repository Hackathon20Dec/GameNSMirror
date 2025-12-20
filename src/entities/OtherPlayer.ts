import Phaser from 'phaser';
import { Gender } from '../types';

export class OtherPlayer extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private nameTag: Phaser.GameObjects.Text;
  private spriteKey: string;
  private targetX: number;
  private targetY: number;
  private lerpSpeed: number = 0.15;
  public playerId: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerId: string,
    name: string,
    gender: Gender
  ) {
    super(scene, x, y);

    this.playerId = playerId;
    this.targetX = x;
    this.targetY = y;
    this.spriteKey = gender === 'male' ? 'player_male' : 'player_female';

    // Create sprite
    this.sprite = scene.add.sprite(0, 0, this.spriteKey, 0);
    this.sprite.setScale(1);
    this.add(this.sprite);

    // Create name tag
    this.nameTag = scene.add.text(0, -35, name, {
      font: 'bold 12px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.nameTag.setOrigin(0.5);
    this.add(this.nameTag);

    // Add to scene
    scene.add.existing(this);

    // Start idle animation
    this.sprite.play(`${this.spriteKey}_idle_down`);
  }

  updatePosition(x: number, y: number, direction: string, isMoving: boolean): void {
    this.targetX = x;
    this.targetY = y;

    // Update animation
    if (isMoving) {
      this.sprite.play(`${this.spriteKey}_walk_${direction}`, true);
    } else {
      this.sprite.play(`${this.spriteKey}_idle_${direction}`, true);
    }
  }

  update(): void {
    // Smoothly interpolate to target position
    this.x = Phaser.Math.Linear(this.x, this.targetX, this.lerpSpeed);
    this.y = Phaser.Math.Linear(this.y, this.targetY, this.lerpSpeed);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
    super.destroy();
  }
}
