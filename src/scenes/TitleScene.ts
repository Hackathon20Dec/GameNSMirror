import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../config/constants';
import { Gender, PlayerData } from '../types';

export class TitleScene extends Phaser.Scene {
  private selectedGender: Gender = 'male';
  private playerName: string = '';
  private nameInput!: HTMLInputElement;
  private malePreview!: Phaser.GameObjects.Sprite;
  private femalePreview!: Phaser.GameObjects.Sprite;
  private selectionIndicator!: Phaser.GameObjects.Rectangle;
  private startButton!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: SCENES.TITLE });
  }

  create(): void {
    // Title
    const title = this.add.text(GAME_WIDTH / 2, 80, 'Farm Life', {
      font: 'bold 48px Arial',
      color: '#ffffff',
      stroke: '#2d5a27',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(GAME_WIDTH / 2, 130, 'Create Your Character', {
      font: '24px Arial',
      color: '#e0e0e0',
    });
    subtitle.setOrigin(0.5);

    // Character selection area
    this.createCharacterSelection();

    // Name input
    this.createNameInput();

    // Start button
    this.createStartButton();
  }

  private createCharacterSelection(): void {
    const centerY = 260;
    const spacing = 120;

    // Selection indicator (behind sprites)
    this.selectionIndicator = this.add.rectangle(
      GAME_WIDTH / 2 - spacing / 2,
      centerY,
      80,
      100,
      0x4ade80,
      0.3
    );
    this.selectionIndicator.setStrokeStyle(3, 0x4ade80);

    // Male character
    const maleLabel = this.add.text(GAME_WIDTH / 2 - spacing / 2, centerY - 70, 'Boy', {
      font: '18px Arial',
      color: '#ffffff',
    });
    maleLabel.setOrigin(0.5);

    this.malePreview = this.add.sprite(GAME_WIDTH / 2 - spacing / 2, centerY, 'player_male', 0);
    this.malePreview.setScale(2);
    this.malePreview.setInteractive({ useHandCursor: true });
    this.malePreview.on('pointerdown', () => this.selectGender('male'));

    // Female character
    const femaleLabel = this.add.text(GAME_WIDTH / 2 + spacing / 2, centerY - 70, 'Girl', {
      font: '18px Arial',
      color: '#ffffff',
    });
    femaleLabel.setOrigin(0.5);

    this.femalePreview = this.add.sprite(GAME_WIDTH / 2 + spacing / 2, centerY, 'player_female', 0);
    this.femalePreview.setScale(2);
    this.femalePreview.setInteractive({ useHandCursor: true });
    this.femalePreview.on('pointerdown', () => this.selectGender('female'));

    // Play idle animation on previews
    this.malePreview.play('player_male_idle_down');
    this.femalePreview.play('player_female_idle_down');
  }

  private selectGender(gender: Gender): void {
    this.selectedGender = gender;
    const spacing = 120;

    if (gender === 'male') {
      this.selectionIndicator.setPosition(GAME_WIDTH / 2 - spacing / 2, 260);
      this.malePreview.setAlpha(1);
      this.femalePreview.setAlpha(0.5);
    } else {
      this.selectionIndicator.setPosition(GAME_WIDTH / 2 + spacing / 2, 260);
      this.malePreview.setAlpha(0.5);
      this.femalePreview.setAlpha(1);
    }
  }

  private createNameInput(): void {
    // Label
    const nameLabel = this.add.text(GAME_WIDTH / 2, 360, 'Enter Your Name:', {
      font: '20px Arial',
      color: '#ffffff',
    });
    nameLabel.setOrigin(0.5);

    // Create DOM input element
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Your name...';
    this.nameInput.maxLength = 12;
    this.nameInput.style.cssText = `
      position: absolute;
      width: 200px;
      padding: 10px 15px;
      font-size: 18px;
      border: 2px solid #4ade80;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
      outline: none;
      text-align: center;
    `;

    // Position input relative to canvas
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;

    this.nameInput.style.left = `${rect.left + (GAME_WIDTH / 2 - 100) * scaleX}px`;
    this.nameInput.style.top = `${rect.top + 390 * scaleY}px`;
    this.nameInput.style.transform = `scale(${scaleX}, ${scaleY})`;
    this.nameInput.style.transformOrigin = 'top left';

    document.body.appendChild(this.nameInput);

    this.nameInput.addEventListener('input', (e) => {
      this.playerName = (e.target as HTMLInputElement).value;
      this.updateStartButton();
    });

    // Update position on resize
    this.scale.on('resize', () => {
      const newRect = canvas.getBoundingClientRect();
      const newScaleX = newRect.width / GAME_WIDTH;
      const newScaleY = newRect.height / GAME_HEIGHT;
      this.nameInput.style.left = `${newRect.left + (GAME_WIDTH / 2 - 100) * newScaleX}px`;
      this.nameInput.style.top = `${newRect.top + 390 * newScaleY}px`;
    });
  }

  private createStartButton(): void {
    const buttonBg = this.add.rectangle(0, 0, 180, 50, 0x4ade80);
    buttonBg.setStrokeStyle(3, 0x22c55e);

    const buttonText = this.add.text(0, 0, 'Start Game', {
      font: 'bold 22px Arial',
      color: '#ffffff',
    });
    buttonText.setOrigin(0.5);

    this.startButton = this.add.container(GAME_WIDTH / 2, 500, [buttonBg, buttonText]);
    this.startButton.setSize(180, 50);
    this.startButton.setInteractive({ useHandCursor: true });
    this.startButton.setAlpha(0.5);

    this.startButton.on('pointerover', () => {
      if (this.playerName.length > 0) {
        buttonBg.setFillStyle(0x22c55e);
      }
    });

    this.startButton.on('pointerout', () => {
      buttonBg.setFillStyle(0x4ade80);
    });

    this.startButton.on('pointerdown', () => {
      if (this.playerName.length > 0) {
        this.startGame();
      }
    });
  }

  private updateStartButton(): void {
    if (this.playerName.length > 0) {
      this.startButton.setAlpha(1);
    } else {
      this.startButton.setAlpha(0.5);
    }
  }

  private startGame(): void {
    // Remove DOM input
    this.nameInput.remove();

    const playerData: PlayerData = {
      name: this.playerName,
      gender: this.selectedGender,
    };

    this.scene.start(SCENES.GAME, { player: playerData });
  }

  shutdown(): void {
    if (this.nameInput && this.nameInput.parentNode) {
      this.nameInput.remove();
    }
  }
}
