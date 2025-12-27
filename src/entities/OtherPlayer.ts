import Phaser from 'phaser';
import { Gender } from '../types';

// Skin definitions - 10 skins per gender
const MALE_SKINS = Array.from({ length: 10 }, (_, i) =>
  `guest_male_${String(i + 1).padStart(2, '0')}`
);
const FEMALE_SKINS = Array.from({ length: 10 }, (_, i) =>
  `guest_female_${String(i + 1).padStart(2, '0')}`
);

export class OtherPlayer extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private nameTag: Phaser.GameObjects.Text;
  private skinKey: string;
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

    // Pick consistent skin based on playerId hash
    this.skinKey = this.getSkinFromPlayerId(playerId, gender);

    // Create sprite with skin
    this.sprite = scene.add.sprite(0, 0, this.skinKey, 0);
    this.sprite.setScale(0.5);
    this.add(this.sprite);

    // Create name tag
    this.nameTag = scene.add.text(0, -45, name, {
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
    this.sprite.play(`${this.skinKey}_idle_down`);
  }

  private getSkinFromPlayerId(playerId: string, gender: Gender): string {
    // Simple hash from playerId for consistent skin across clients
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const skins = gender === 'male' ? MALE_SKINS : FEMALE_SKINS;
    const index = Math.abs(hash) % skins.length;
    return skins[index];
  }

  updatePosition(x: number, y: number, direction: string, isMoving: boolean): void {
    this.targetX = x;
    this.targetY = y;

    // Normalize direction
    const validDir = ['up', 'down', 'left', 'right'].includes(direction) ? direction : 'down';

    // Update animation
    const animType = isMoving ? 'walk' : 'idle';
    const animKey = `${this.skinKey}_${animType}_${validDir}`;
    const currentAnim = this.sprite.anims.currentAnim;

    if (!currentAnim || currentAnim.key !== animKey) {
      this.sprite.play(animKey, true);
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
