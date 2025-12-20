import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config/constants';
import { Gender } from '../types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spriteKey: string;
  private _currentDirection: string = 'down';
  private _isMoving: boolean = false;
  public playerName: string;

  // Joystick input from external source (mobile)
  public joystickX: number = 0;
  public joystickY: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    gender: Gender
  ) {
    const spriteKey = gender === 'male' ? 'player_male' : 'player_female';
    super(scene, x, y, spriteKey, 0);

    this.spriteKey = spriteKey;
    this.playerName = name;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics body
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 20);
    body.setOffset(6, 28);

    // Set up input
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Start with idle animation
    this.play(`${this.spriteKey}_idle_down`);
  }

  update(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Reset velocity
    body.setVelocity(0);

    // Get keyboard input
    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S.isDown;

    // Calculate velocity from keyboard
    let velocityX = 0;
    let velocityY = 0;

    if (left) velocityX = -PLAYER_SPEED;
    if (right) velocityX = PLAYER_SPEED;
    if (up) velocityY = -PLAYER_SPEED;
    if (down) velocityY = PLAYER_SPEED;

    // Add joystick input (for mobile)
    if (this.joystickX !== 0 || this.joystickY !== 0) {
      velocityX = this.joystickX * PLAYER_SPEED;
      velocityY = this.joystickY * PLAYER_SPEED;
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      if (magnitude > PLAYER_SPEED) {
        velocityX = (velocityX / magnitude) * PLAYER_SPEED;
        velocityY = (velocityY / magnitude) * PLAYER_SPEED;
      }
    }

    body.setVelocity(velocityX, velocityY);

    // Update animation based on movement
    if (velocityX !== 0 || velocityY !== 0) {
      this._isMoving = true;

      // Set walking direction based on velocity priority
      if (Math.abs(velocityX) > Math.abs(velocityY)) {
        this._currentDirection = velocityX < 0 ? 'left' : 'right';
      } else if (velocityY !== 0) {
        this._currentDirection = velocityY < 0 ? 'up' : 'down';
      }

      this.play(`${this.spriteKey}_walk_${this._currentDirection}`, true);
    } else {
      this._isMoving = false;
      // Idle
      this.play(`${this.spriteKey}_idle_${this._currentDirection}`, true);
    }
  }

  get currentDirection(): string {
    return this._currentDirection;
  }

  get isMoving(): boolean {
    return this._isMoving;
  }
}
