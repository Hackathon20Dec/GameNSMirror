import Phaser from 'phaser';
import { Gender, PlayerData } from '../types';

// Stardew Valley-inspired warm color palette
const COLORS = {
  skyBlue: 0x5ba3d0,
  cloudWhite: 0xffffff,
  grassGreen: 0x5a8f3e,
  grassDark: 0x3d6b2a,
  titleOrange: 0xc4622a,
  titleShadow: 0x7a3a18,
  woodBrown: 0x8b5a2b,
  woodDark: 0x5c3d1e,
  cream: 0xfff8e7,
  warmWhite: 0xffeedd,
  leafGreen: 0x4a7c3a,
  leafDark: 0x2d5a22,
  cardBg: 0xf5e6d3,
  cardBorder: 0x8b6b4a,
  selectedGlow: 0x7cb342,
  buttonGreen: 0x6b9b37,
  buttonGreenHover: 0x5a8a2a,
  inputBg: 0xfff9f0,
};

export default class TitleScene extends Phaser.Scene {
  private selectedGender: Gender = 'male';
  private selectedSkinIndex: number = 1;
  private playerName: string = '';
  private nameInput!: HTMLInputElement;
  private maleCards: Phaser.GameObjects.Container[] = [];
  private femaleCards: Phaser.GameObjects.Container[] = [];
  private startButton!: Phaser.GameObjects.Container;
  private genderTabs!: { male: Phaser.GameObjects.Container; female: Phaser.GameObjects.Container };
  private characterGrid!: Phaser.GameObjects.Container;
  private scrollOffset: number = 0;
  private gameWidth: number = 800;
  private gameHeight: number = 600;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    // Get actual game dimensions for responsive layout
    this.gameWidth = this.cameras.main.width;
    this.gameHeight = this.cameras.main.height;

    // Create the cozy Stardew Valley aesthetic
    this.createBackground();
    this.createDecorations();
    this.createTitle();
    this.createCharacterSelection();
    this.createNameInput();
    this.createStartButton();

    // Handle resize
    this.scale.on('resize', this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.gameWidth = gameSize.width;
    this.gameHeight = gameSize.height;

    // Reposition name input
    this.repositionNameInput();
  }

  private createBackground(): void {
    // Use the loading screen as base background for consistency
    if (this.textures.exists('loading_bg')) {
      const bg = this.add.image(this.gameWidth / 2, this.gameHeight / 2, 'loading_bg');
      const scaleX = this.gameWidth / bg.width;
      const scaleY = this.gameHeight / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
      bg.setDepth(-10);

      // Add a semi-transparent overlay to make UI elements pop
      const overlay = this.add.rectangle(
        this.gameWidth / 2,
        this.gameHeight / 2,
        this.gameWidth,
        this.gameHeight,
        0x000000,
        0.3
      );
      overlay.setDepth(-5);
    } else {
      // Fallback gradient sky
      this.cameras.main.setBackgroundColor('#5ba3d0');
      this.createFallbackBackground();
    }
  }

  private createFallbackBackground(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(-10);

    // Sky gradient
    for (let i = 0; i < this.gameHeight * 0.6; i++) {
      const ratio = i / (this.gameHeight * 0.6);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x87ceeb),
        Phaser.Display.Color.IntegerToColor(0x5ba3d0),
        100,
        ratio * 100
      );
      graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
      graphics.fillRect(0, i, this.gameWidth, 1);
    }

    // Ground
    graphics.fillStyle(COLORS.grassGreen);
    graphics.fillRect(0, this.gameHeight * 0.6, this.gameWidth, this.gameHeight * 0.4);
  }

  private createDecorations(): void {
    // Add floating pixel clouds
    this.createPixelCloud(this.gameWidth * 0.15, 60, 0.8);
    this.createPixelCloud(this.gameWidth * 0.85, 90, 0.6);
    this.createPixelCloud(this.gameWidth * 0.5, 40, 0.5);

    // Add decorative vines around title area
    this.createVine(this.gameWidth * 0.12, 50, 'left');
    this.createVine(this.gameWidth * 0.88, 50, 'right');
  }

  private createPixelCloud(x: number, y: number, scale: number): void {
    const cloud = this.add.graphics();
    cloud.setDepth(-3);

    // Pixel cloud shape
    cloud.fillStyle(0xffffff, 0.9);

    // Main cloud body (pixelated look)
    const baseSize = 12 * scale;
    cloud.fillRect(x - baseSize * 2, y, baseSize * 4, baseSize * 2);
    cloud.fillRect(x - baseSize * 3, y + baseSize * 0.5, baseSize, baseSize);
    cloud.fillRect(x + baseSize * 2, y + baseSize * 0.5, baseSize, baseSize);
    cloud.fillRect(x - baseSize * 1.5, y - baseSize * 0.5, baseSize * 3, baseSize);

    // Subtle animation
    this.tweens.add({
      targets: cloud,
      x: x + 20,
      duration: 4000 + Math.random() * 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createVine(x: number, y: number, side: 'left' | 'right'): void {
    const vine = this.add.graphics();
    vine.setDepth(5);

    // Vine stem
    vine.fillStyle(COLORS.leafDark);
    const stemX = side === 'left' ? x : x - 4;
    vine.fillRect(stemX, y, 4, 80);

    // Leaves
    vine.fillStyle(COLORS.leafGreen);
    const leafPositions = [
      { dx: side === 'left' ? 4 : -12, dy: 10 },
      { dx: side === 'left' ? -8 : 4, dy: 25 },
      { dx: side === 'left' ? 6 : -14, dy: 45 },
      { dx: side === 'left' ? -6 : 2, dy: 60 },
    ];

    leafPositions.forEach(pos => {
      vine.fillRect(stemX + pos.dx, y + pos.dy, 10, 6);
      vine.fillRect(stemX + pos.dx + 2, y + pos.dy - 2, 6, 4);
    });

    // Gentle sway animation
    this.tweens.add({
      targets: vine,
      angle: side === 'left' ? -3 : 3,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createTitle(): void {
    const centerX = this.gameWidth / 2;
    const titleY = Math.min(80, this.gameHeight * 0.1);

    // "THE" text - smaller, above main title
    const theText = this.add.text(centerX, titleY - 20, 'THE', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#c4622a',
      stroke: '#5c3d1e',
      strokeThickness: 3,
    });
    theText.setOrigin(0.5);
    theText.setDepth(10);

    // Main title "NETWORK SIM"
    const titleText = this.add.text(centerX, titleY + 20, 'NETWORK SIM', {
      fontFamily: 'Georgia, serif',
      fontSize: Math.min(42, this.gameWidth * 0.06) + 'px',
      fontStyle: 'bold',
      color: '#c4622a',
      stroke: '#5c3d1e',
      strokeThickness: 5,
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(10);

    // Subtle shadow for depth
    const shadowText = this.add.text(centerX + 3, titleY + 23, 'NETWORK SIM', {
      fontFamily: 'Georgia, serif',
      fontSize: Math.min(42, this.gameWidth * 0.06) + 'px',
      fontStyle: 'bold',
      color: '#3d2815',
    });
    shadowText.setOrigin(0.5);
    shadowText.setDepth(9);
    shadowText.setAlpha(0.4);

    // Subtitle
    const subtitle = this.add.text(centerX, titleY + 60, 'Choose Your Character', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#fff8e7',
      stroke: '#5c3d1e',
      strokeThickness: 2,
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);
  }

  private createCharacterSelection(): void {
    const centerX = this.gameWidth / 2;
    const startY = Math.min(140, this.gameHeight * 0.18);

    // Create gender tabs
    this.createGenderTabs(centerX, startY);

    // Create character grid container
    this.characterGrid = this.add.container(centerX, startY + 50);
    this.characterGrid.setDepth(10);

    // Create character cards for both genders
    this.createCharacterCards();

    // Show initial gender
    this.showGenderCards('male');
  }

  private createGenderTabs(centerX: number, y: number): void {
    const tabWidth = Math.min(100, this.gameWidth * 0.15);
    const tabHeight = 36;
    const spacing = 10;

    // Male tab
    const maleTab = this.createTab(centerX - tabWidth / 2 - spacing / 2, y, tabWidth, tabHeight, 'Boy', true);
    maleTab.setInteractive(new Phaser.Geom.Rectangle(-tabWidth / 2, -tabHeight / 2, tabWidth, tabHeight), Phaser.Geom.Rectangle.Contains);
    maleTab.on('pointerdown', () => this.selectGenderTab('male'));
    maleTab.on('pointerover', () => {
      if (this.selectedGender !== 'male') {
        (maleTab.getAt(0) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.cardBg);
      }
    });
    maleTab.on('pointerout', () => {
      if (this.selectedGender !== 'male') {
        (maleTab.getAt(0) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.woodBrown, 0.8);
      }
    });

    // Female tab
    const femaleTab = this.createTab(centerX + tabWidth / 2 + spacing / 2, y, tabWidth, tabHeight, 'Girl', false);
    femaleTab.setInteractive(new Phaser.Geom.Rectangle(-tabWidth / 2, -tabHeight / 2, tabWidth, tabHeight), Phaser.Geom.Rectangle.Contains);
    femaleTab.on('pointerdown', () => this.selectGenderTab('female'));
    femaleTab.on('pointerover', () => {
      if (this.selectedGender !== 'female') {
        (femaleTab.getAt(0) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.cardBg);
      }
    });
    femaleTab.on('pointerout', () => {
      if (this.selectedGender !== 'female') {
        (femaleTab.getAt(0) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.woodBrown, 0.8);
      }
    });

    this.genderTabs = { male: maleTab, female: femaleTab };
  }

  private createTab(x: number, y: number, width: number, height: number, label: string, active: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(10);

    // Tab background
    const bg = this.add.rectangle(0, 0, width, height, active ? COLORS.cardBg : COLORS.woodBrown, active ? 1 : 0.8);
    bg.setStrokeStyle(2, COLORS.woodDark);

    // Tab label
    const text = this.add.text(0, 0, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: active ? '#5c3d1e' : '#fff8e7',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    container.add([bg, text]);
    return container;
  }

  private selectGenderTab(gender: Gender): void {
    if (this.selectedGender === gender) return;

    this.selectedGender = gender;
    this.selectedSkinIndex = 1;

    // Update tab visuals
    const maleTab = this.genderTabs.male;
    const femaleTab = this.genderTabs.female;

    const maleBg = maleTab.getAt(0) as Phaser.GameObjects.Rectangle;
    const maleText = maleTab.getAt(1) as Phaser.GameObjects.Text;
    const femaleBg = femaleTab.getAt(0) as Phaser.GameObjects.Rectangle;
    const femaleText = femaleTab.getAt(1) as Phaser.GameObjects.Text;

    if (gender === 'male') {
      maleBg.setFillStyle(COLORS.cardBg);
      maleText.setColor('#5c3d1e');
      femaleBg.setFillStyle(COLORS.woodBrown, 0.8);
      femaleText.setColor('#fff8e7');
    } else {
      femaleBg.setFillStyle(COLORS.cardBg);
      femaleText.setColor('#5c3d1e');
      maleBg.setFillStyle(COLORS.woodBrown, 0.8);
      maleText.setColor('#fff8e7');
    }

    this.showGenderCards(gender);
  }

  private createCharacterCards(): void {
    // Smaller cards to fit better on screen
    const cardWidth = Math.min(55, this.gameWidth * 0.08);
    const cardHeight = cardWidth * 1.2;
    const spacing = Math.min(10, this.gameWidth * 0.015);
    const cols = 5; // Always use 5 columns
    const totalWidth = cols * cardWidth + (cols - 1) * spacing;

    // Male cards - single row of 5, second row of 5
    for (let i = 1; i <= 10; i++) {
      const col = (i - 1) % cols;
      const row = Math.floor((i - 1) / cols);
      const x = (col - (cols - 1) / 2) * (cardWidth + spacing);
      const y = row * (cardHeight + spacing + 5);

      const card = this.createCharacterCard(x, y, cardWidth, cardHeight, 'male', i);
      this.maleCards.push(card);
      this.characterGrid.add(card);
    }

    // Female cards (initially hidden and non-interactive)
    for (let i = 1; i <= 10; i++) {
      const col = (i - 1) % cols;
      const row = Math.floor((i - 1) / cols);
      const x = (col - (cols - 1) / 2) * (cardWidth + spacing);
      const y = row * (cardHeight + spacing + 5);

      const card = this.createCharacterCard(x, y, cardWidth, cardHeight, 'female', i);
      card.setVisible(false);
      // Disable input on hidden cards to prevent them from blocking clicks
      const cardBg = card.getData('cardBg') as Phaser.GameObjects.Rectangle;
      if (cardBg && cardBg.input) {
        cardBg.input.enabled = false;
      }
      this.femaleCards.push(card);
      this.characterGrid.add(card);
    }
  }

  private createCharacterCard(x: number, y: number, width: number, height: number, gender: Gender, index: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Selection glow (initially hidden) - add first so it's behind
    const glow = this.add.rectangle(0, 0, width + 6, height + 6, COLORS.selectedGlow, 0.6);
    glow.setStrokeStyle(2, COLORS.selectedGlow);
    glow.setVisible(gender === 'male' && index === 1);
    glow.setName('glow');

    // Card background with wooden frame style
    const cardBg = this.add.rectangle(0, 0, width, height, COLORS.cardBg);
    cardBg.setStrokeStyle(2, COLORS.cardBorder);

    // Character sprite
    const spriteKey = `guest_${gender}_${String(index).padStart(2, '0')}`;
    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;

    if (this.textures.exists(spriteKey)) {
      sprite = this.add.sprite(0, -3, spriteKey, 0);
      const scale = Math.min((width - 8) / 128, (height - 16) / 128);
      sprite.setScale(scale);

      // Play idle animation if exists
      const animKey = `${spriteKey}_idle_down`;
      if (this.anims.exists(animKey)) {
        sprite.play(animKey);
      }
    } else {
      // Fallback colored rectangle
      const color = gender === 'male' ? 0x4a90d9 : 0xe91e8c;
      sprite = this.add.rectangle(0, -3, width * 0.5, height * 0.5, color);
    }

    // Character number label
    const label = this.add.text(0, height / 2 - 10, `#${index}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#5c3d1e',
    });
    label.setOrigin(0.5);

    container.add([glow, cardBg, sprite, label]);

    // Make the CARD BACKGROUND interactive (not the container)
    // This is more reliable for nested containers
    cardBg.setInteractive({ useHandCursor: true });
    cardBg.setData('gender', gender);
    cardBg.setData('index', index);

    cardBg.on('pointerdown', () => {
      console.log(`Selected: ${gender} #${index}`);
      this.selectCharacter(gender, index);
    });

    cardBg.on('pointerover', () => {
      cardBg.setFillStyle(COLORS.cream);
    });

    cardBg.on('pointerout', () => {
      cardBg.setFillStyle(COLORS.cardBg);
    });

    // Store reference to cardBg for enabling/disabling input
    container.setData('cardBg', cardBg);

    return container;
  }

  private showGenderCards(gender: Gender): void {
    // Show/hide cards AND enable/disable their interactivity
    // In Phaser, setVisible(false) doesn't disable input - hidden cards can still block clicks
    this.maleCards.forEach(card => {
      const isVisible = gender === 'male';
      card.setVisible(isVisible);
      // Enable/disable the cardBg's input
      const cardBg = card.getData('cardBg') as Phaser.GameObjects.Rectangle;
      if (cardBg && cardBg.input) {
        cardBg.input.enabled = isVisible;
      }
    });
    this.femaleCards.forEach(card => {
      const isVisible = gender === 'female';
      card.setVisible(isVisible);
      // Enable/disable the cardBg's input
      const cardBg = card.getData('cardBg') as Phaser.GameObjects.Rectangle;
      if (cardBg && cardBg.input) {
        cardBg.input.enabled = isVisible;
      }
    });

    // Update selection glow
    this.updateSelectionGlow();
  }

  private selectCharacter(gender: Gender, index: number): void {
    // Check if we need to switch tabs BEFORE updating selectedGender
    const needsTabSwitch = this.selectedGender !== gender;

    this.selectedGender = gender;
    this.selectedSkinIndex = index;
    this.updateSelectionGlow();

    // Switch tab if clicking a character from the other gender
    if (needsTabSwitch) {
      this.selectGenderTab(gender);
    }
  }

  private updateSelectionGlow(): void {
    const cards = this.selectedGender === 'male' ? this.maleCards : this.femaleCards;
    const otherCards = this.selectedGender === 'male' ? this.femaleCards : this.maleCards;

    // Hide all glows
    [...cards, ...otherCards].forEach(card => {
      const glow = card.getByName('glow') as Phaser.GameObjects.Rectangle;
      if (glow) glow.setVisible(false);
    });

    // Show selected glow
    const selectedCard = cards[this.selectedSkinIndex - 1];
    if (selectedCard) {
      const glow = selectedCard.getByName('glow') as Phaser.GameObjects.Rectangle;
      if (glow) {
        glow.setVisible(true);
        // Pulse animation
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.5, to: 0.8 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  private createNameInput(): void {
    const centerX = this.gameWidth / 2;
    const inputY = Math.min(380, this.gameHeight * 0.65);

    // Label with cozy styling
    const nameLabel = this.add.text(centerX, inputY - 25, 'Enter Your Name', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#fff8e7',
      stroke: '#5c3d1e',
      strokeThickness: 2,
    });
    nameLabel.setOrigin(0.5);
    nameLabel.setDepth(10);

    // Create DOM input element with Stardew-style
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Your name...';
    this.nameInput.maxLength = 12;
    this.nameInput.style.cssText = `
      position: absolute;
      width: 220px;
      padding: 12px 18px;
      font-size: 16px;
      font-family: Georgia, serif;
      border: 3px solid #8b6b4a;
      border-radius: 6px;
      background: #fff9f0;
      color: #5c3d1e;
      outline: none;
      text-align: center;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.5);
      transition: border-color 0.2s, box-shadow 0.2s;
    `;

    // Focus styling
    this.nameInput.addEventListener('focus', () => {
      this.nameInput.style.borderColor = '#6b9b37';
      this.nameInput.style.boxShadow = '0 4px 12px rgba(107, 155, 55, 0.3), inset 0 2px 4px rgba(255,255,255,0.5)';
    });

    this.nameInput.addEventListener('blur', () => {
      this.nameInput.style.borderColor = '#8b6b4a';
      this.nameInput.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.5)';
    });

    document.body.appendChild(this.nameInput);
    this.repositionNameInput();

    this.nameInput.addEventListener('input', (e) => {
      this.playerName = (e.target as HTMLInputElement).value;
      this.updateStartButton();
    });
  }

  private repositionNameInput(): void {
    if (!this.nameInput) return;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const inputY = Math.min(380, this.gameHeight * 0.65);

    const scaleX = rect.width / this.gameWidth;
    const scaleY = rect.height / this.gameHeight;

    this.nameInput.style.left = `${rect.left + (this.gameWidth / 2 - 110) * scaleX}px`;
    this.nameInput.style.top = `${rect.top + inputY * scaleY}px`;
    this.nameInput.style.transform = `scale(${Math.min(scaleX, scaleY)})`;
    this.nameInput.style.transformOrigin = 'top left';
  }

  private createStartButton(): void {
    const centerX = this.gameWidth / 2;
    const buttonY = Math.min(480, this.gameHeight * 0.80);
    const buttonWidth = Math.min(180, this.gameWidth * 0.25);
    const buttonHeight = 45;

    // Button shadow for depth
    const buttonShadow = this.add.rectangle(2, 2, buttonWidth, buttonHeight, 0x000000, 0.3);

    // Button background with wooden style
    const buttonBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, COLORS.buttonGreen);
    buttonBg.setStrokeStyle(3, COLORS.woodDark);

    // Button text
    const buttonText = this.add.text(0, 0, 'Start Adventure', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#3d5a1e',
      strokeThickness: 2,
    });
    buttonText.setOrigin(0.5);

    this.startButton = this.add.container(centerX, buttonY, [buttonShadow, buttonBg, buttonText]);
    this.startButton.setSize(buttonWidth, buttonHeight);
    this.startButton.setDepth(15); // Higher depth to ensure it's on top
    this.startButton.setAlpha(0.5);

    // Make the button background interactive (more reliable than container)
    buttonBg.setInteractive({ useHandCursor: true });

    buttonBg.on('pointerover', () => {
      if (this.playerName.length > 0) {
        buttonBg.setFillStyle(COLORS.buttonGreenHover);
      }
    });

    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(COLORS.buttonGreen);
    });

    buttonBg.on('pointerdown', () => {
      console.log('Start button clicked, name:', this.playerName, 'gender:', this.selectedGender, 'skin:', this.selectedSkinIndex);
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

    // Clean up resize listener
    this.scale.off('resize', this.handleResize, this);

    const playerData: PlayerData = {
      name: this.playerName,
      gender: this.selectedGender,
      skinIndex: this.selectedSkinIndex,
    };

    // Fade out transition
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', { player: playerData });
    });
  }

  shutdown(): void {
    if (this.nameInput && this.nameInput.parentNode) {
      this.nameInput.remove();
    }
    this.scale.off('resize', this.handleResize, this);
  }
}
