import Phaser from 'phaser';
import { chat, ChatMessage } from '../lib/ai';
import { NPCCharacter } from '../data/npcCharacters';

type Direction = 'down' | 'left' | 'right' | 'up';

export class AINPC extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite;
  private nameTag: Phaser.GameObjects.Text;
  private speechBubble: Phaser.GameObjects.Container | null = null;
  private interactionPrompt: Phaser.GameObjects.Text;

  public npcId: string;
  public npcName: string;
  private spriteKey: string;
  private systemPrompt: string;
  private greeting: string;
  private npcColor: string;

  private conversationHistory: ChatMessage[] = [];
  private isTyping: boolean = false;
  private playerInRange: boolean = false;

  private currentDirection: Direction = 'down';
  private playerX: number = 0;
  private playerY: number = 0;

  private onChatCallback: ((name: string, text: string, color: string) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    character: NPCCharacter
  ) {
    super(scene, x, y);

    this.npcId = character.id;
    this.npcName = character.name;
    this.spriteKey = character.spriteKey;
    this.systemPrompt = character.systemPrompt;
    this.greeting = character.greeting;
    this.npcColor = character.color;

    // Create sprite with initial frame (frame 0 = facing down)
    this.sprite = scene.add.sprite(0, 0, character.spriteKey, 0);
    this.sprite.setScale(0.5); // Scale for 128x128 frames
    this.sprite.setOrigin(0.5, 1);
    this.add(this.sprite);

    // Play initial idle animation
    this.sprite.play(`${this.spriteKey}_idle_down`);

    // Create name tag
    this.nameTag = scene.add.text(0, -this.sprite.displayHeight - 10, character.name, {
      font: 'bold 14px Arial',
      color: character.color,
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.nameTag.setOrigin(0.5);
    this.add(this.nameTag);

    // Create interaction prompt (hidden by default)
    this.interactionPrompt = scene.add.text(0, 20, 'Press ENTER to talk', {
      font: 'bold 11px Arial',
      color: '#4ade80',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setVisible(false);
    this.add(this.interactionPrompt);

    // Add to scene
    scene.add.existing(this);

    // Set depth for proper layering
    this.setDepth(3);
  }

  setOnChat(callback: (name: string, text: string, color: string) => void): void {
    this.onChatCallback = callback;
  }

  setPlayerPosition(playerX: number, playerY: number): void {
    this.playerX = playerX;
    this.playerY = playerY;
  }

  setPlayerInRange(inRange: boolean): void {
    if (this.playerInRange !== inRange) {
      this.playerInRange = inRange;
      this.interactionPrompt.setVisible(inRange);

      // Greet player when they enter range for the first time
      if (inRange && this.conversationHistory.length === 0) {
        this.showMessage(this.greeting);
        this.conversationHistory.push({
          role: 'assistant',
          content: this.greeting
        });
      }
    }
  }

  isInRange(): boolean {
    return this.playerInRange;
  }

  isProcessing(): boolean {
    return this.isTyping;
  }

  async respondToPlayer(playerMessage: string): Promise<void> {
    if (this.isTyping) return;

    this.isTyping = true;

    // Add player message to history
    this.conversationHistory.push({
      role: 'user',
      content: playerMessage
    });

    // Show typing indicator
    this.showMessage('...');

    try {
      // Get AI response
      const response = await chat(this.systemPrompt, this.conversationHistory);

      // Add to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response
      });

      // Show response
      this.showMessage(response);

      // Keep conversation history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }
    } catch (error) {
      console.error('NPC response error:', error);
      this.showMessage("Hmm, let me think about that...");
    }

    this.isTyping = false;
  }

  private showMessage(text: string): void {
    // Send to chat UI
    if (this.onChatCallback) {
      this.onChatCallback(this.npcName, text, this.npcColor);
    }

    // Also show speech bubble above NPC
    this.showSpeechBubble(text);
  }

  private showSpeechBubble(text: string): void {
    // Remove existing bubble
    if (this.speechBubble) {
      this.speechBubble.destroy();
      this.speechBubble = null;
    }

    // Create bubble container
    this.speechBubble = this.scene.add.container(0, -this.sprite.displayHeight - 40);

    // Truncate text for bubble (full text goes to chat)
    const bubbleText = text.length > 80 ? text.substring(0, 77) + '...' : text;

    // Create text first to measure
    const messageText = this.scene.add.text(0, 0, bubbleText, {
      font: '11px Arial',
      color: '#ffffff',
      wordWrap: { width: 180 },
      align: 'center',
    });
    messageText.setOrigin(0.5);

    // Create bubble background
    const padding = 10;
    const bubbleWidth = Math.min(200, messageText.width + padding * 2);
    const bubbleHeight = messageText.height + padding * 2;

    const bubbleBg = this.scene.add.graphics();
    bubbleBg.fillStyle(0x000000, 0.8);
    bubbleBg.fillRoundedRect(
      -bubbleWidth / 2,
      -bubbleHeight / 2,
      bubbleWidth,
      bubbleHeight,
      8
    );

    // Add pointer triangle
    bubbleBg.fillTriangle(
      -5, bubbleHeight / 2,
      5, bubbleHeight / 2,
      0, bubbleHeight / 2 + 8
    );

    this.speechBubble.add(bubbleBg);
    this.speechBubble.add(messageText);
    this.add(this.speechBubble);

    // Auto-hide after delay
    this.scene.time.delayedCall(5000, () => {
      if (this.speechBubble) {
        this.scene.tweens.add({
          targets: this.speechBubble,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            if (this.speechBubble) {
              this.speechBubble.destroy();
              this.speechBubble = null;
            }
          }
        });
      }
    });
  }

  private calculateDirectionToPlayer(): Direction {
    const dx = this.playerX - this.x;
    const dy = this.playerY - this.y;

    // Determine primary direction based on which axis has greater difference
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal movement is primary
      return dx > 0 ? 'right' : 'left';
    } else {
      // Vertical movement is primary
      return dy > 0 ? 'down' : 'up';
    }
  }

  private updateDirection(): void {
    if (!this.playerInRange) {
      // Default to facing down when no player nearby
      if (this.currentDirection !== 'down') {
        this.currentDirection = 'down';
        this.sprite.play(`${this.spriteKey}_idle_down`);
      }
      return;
    }

    // Calculate direction to face the player
    const newDirection = this.calculateDirectionToPlayer();

    // Only update animation if direction changed
    if (newDirection !== this.currentDirection) {
      this.currentDirection = newDirection;
      this.sprite.play(`${this.spriteKey}_idle_${newDirection}`);
    }
  }

  update(): void {
    // Update facing direction based on player position
    this.updateDirection();

    // Gentle bob animation
    const time = this.scene.time.now;
    this.sprite.y = Math.sin(time / 500) * 2;
  }

  destroy(): void {
    if (this.speechBubble) {
      this.speechBubble.destroy();
    }
    super.destroy();
  }
}
