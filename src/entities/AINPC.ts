import Phaser from 'phaser';
import { chat, ChatMessage, speakText, stopSpeaking } from '../lib/ai';
import { NPCCharacter } from '../data/npcCharacters';

type Direction = 'down' | 'left' | 'right' | 'up';
type Mood = 'curious' | 'excited' | 'thoughtful' | 'challenging' | 'welcoming';

/**
 * Dynamic greetings - sound like REAL people, not NPCs
 */
const DYNAMIC_GREETINGS: Record<string, { first: string[]; returning: string[] }> = {
  balaji: {
    first: [
      "So, you made it here. Most people don't. What do you want to know?",
      "Interesting. New face. Are you here to build something or just asking questions?",
      "Hey. I'm Balaji. Fair warning - I don't do small talk. What's on your mind?",
    ],
    returning: [
      "You're back. Good. What have you been thinking about since we talked?",
      "So, any progress? Or still processing?",
      "Alright, round two. What's the question?",
    ],
  },
  jackson: {
    first: [
      "Yo! New face! I'm Jackson - welcome to the network. What's your story?",
      "Hey hey! Love meeting new people. I'm Jackson. What brings you here?",
      "Oh nice! Fresh energy. I'm Jackson - I basically live to connect cool people. Who are you?",
    ],
    returning: [
      "Hey you're back! How's it going? Been thinking about anything interesting?",
      "Yooo welcome back! What's new in your world?",
      "Hey friend! Good to see you. What's on your mind?",
    ],
  },
  otavio: {
    first: [
      "New person. What have you shipped lately? And don't say 'ideas.'",
      "Hey. I'm Otavio. Quick question - are you a builder or a talker?",
      "Alright, new face. Impress me. What are you working on?",
    ],
    returning: [
      "You're back. Did you actually do something since last time, or just think about it?",
      "Round two. Show me progress.",
      "Alright, what did you ship? Don't tell me 'nothing.'",
    ],
  },
  yash: {
    first: [
      "Hey! I'm Yash. Quick question - what's the thing that's blocking you right now?",
      "Welcome! I love helping people figure out their bottlenecks. What's yours?",
      "Hey there! I'm Yash. Tell me - what are you trying to optimize?",
    ],
    returning: [
      "Hey you're back! Any new constraints to work through?",
      "Welcome back! What's the current bottleneck?",
      "Good to see you! What needs unblocking today?",
    ],
  },
};


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
  private hasMetPlayer: boolean = false;
  private currentMood: Mood = 'welcoming';
  private lastInteractionTime: number = 0;
  private idleTime: number = 0;

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
    const wasInRange = this.playerInRange;
    this.playerInRange = inRange;
    this.interactionPrompt.setVisible(inRange);

    // Stop speaking when player leaves
    if (!inRange && wasInRange) {
      stopSpeaking();
    }

    // Only greet when player ENTERS range (not already in range)
    if (inRange && !wasInRange && !this.isTyping) {
      // Get dynamic greeting based on whether we've met before
      const dynamicGreeting = this.getDynamicGreeting();
      this.showMessage(dynamicGreeting);
      this.conversationHistory.push({
        role: 'assistant',
        content: dynamicGreeting
      });
      this.hasMetPlayer = true;
      this.lastInteractionTime = Date.now();
      this.idleTime = 0;
    }
  }

  /**
   * Get a contextual greeting based on whether this is first meeting or returning
   */
  private getDynamicGreeting(): string {
    const greetings = DYNAMIC_GREETINGS[this.npcId];
    if (!greetings) return this.greeting;

    const pool = this.hasMetPlayer ? greetings.returning : greetings.first;
    return pool[Math.floor(Math.random() * pool.length)];
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
    this.lastInteractionTime = Date.now();

    // Add player message to history
    this.conversationHistory.push({
      role: 'user',
      content: playerMessage
    });

    // Show typing indicator (don't speak this)
    this.showMessage('...', false);

    try {
      // Build enhanced system prompt with conversation context
      const enhancedPrompt = this.buildEnhancedPrompt();

      // Get AI response with NPC ID for character-specific fallbacks
      const response = await chat(enhancedPrompt, this.conversationHistory, this.npcId);

      // Add to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response
      });

      // Show response
      this.showMessage(response);

      // Update mood based on conversation
      this.updateMood(playerMessage);

      // Keep conversation history manageable (last 10 exchanges)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }
    } catch (error) {
      console.error('NPC response error:', error);
      // Use character-specific fallback even in error case
      const fallback = await chat(this.systemPrompt, [], this.npcId);
      this.showMessage(fallback);
    }

    this.isTyping = false;
  }

  /**
   * Build enhanced prompt - keep it simple and authentic
   */
  private buildEnhancedPrompt(): string {
    const msgCount = Math.ceil(this.conversationHistory.length / 2);

    // Simple context injection
    let context = '';
    if (msgCount > 3) {
      context = "\n\nNote: You've been chatting for a bit now. Feel free to be more direct/casual.";
    }

    return `${this.systemPrompt}${context}

IMPORTANT: Respond naturally in 1-3 sentences like you're actually texting. No essays. Sound human.`;
  }

  /**
   * Update mood based on player's message - affects NPC's response tone
   */
  private updateMood(playerMessage: string): void {
    const msg = playerMessage.toLowerCase();

    if (msg.includes('?')) {
      this.currentMood = 'curious';
    } else if (msg.includes('!') || msg.includes('awesome') || msg.includes('cool')) {
      this.currentMood = 'excited';
    } else if (msg.includes('but') || msg.includes('disagree') || msg.includes('no')) {
      this.currentMood = 'challenging';
    } else {
      this.currentMood = 'welcoming';
    }
  }

  private showMessage(text: string, speak: boolean = true): void {
    // Send to chat UI
    if (this.onChatCallback) {
      this.onChatCallback(this.npcName, text, this.npcColor);
    }

    // Also show speech bubble above NPC
    this.showSpeechBubble(text);

    // Speak with ElevenLabs - but NOT for typing indicators
    const isTypingIndicator = text === '...' || text.includes('processing') || text.includes('thinking') || text.includes('analyzing');
    if (speak && !isTypingIndicator && text.length > 3) {
      speakText(text, this.npcId);
    }
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
