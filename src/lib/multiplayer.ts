import { PlayerState, Gender } from '../types';

type PlayerJoinCallback = (player: PlayerState) => void;
type PlayerLeaveCallback = (playerId: string) => void;
type PlayerMoveCallback = (player: PlayerState) => void;
type ChatCallback = (playerId: string, name: string, text: string) => void;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3001';

export class MultiplayerManager {
  private ws: WebSocket | null = null;
  private playerId: string;
  private playerName: string;
  private playerGender: Gender;
  private onPlayerJoin: PlayerJoinCallback | null = null;
  private onPlayerLeave: PlayerLeaveCallback | null = null;
  private onPlayerMove: PlayerMoveCallback | null = null;
  private onChat: ChatCallback | null = null;
  private lastBroadcast: number = 0;
  private broadcastInterval: number = 50; // ms between broadcasts
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private initialX: number;
  private initialY: number;

  constructor(playerId: string, name: string, gender: Gender, x: number = 400, y: number = 300) {
    this.playerId = playerId;
    this.playerName = name;
    this.playerGender = gender;
    this.initialX = x;
    this.initialY = y;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Convert http(s) to ws(s) if needed
        let wsUrl = SERVER_URL;
        if (wsUrl.startsWith('http://')) {
          wsUrl = wsUrl.replace('http://', 'ws://');
        } else if (wsUrl.startsWith('https://')) {
          wsUrl = wsUrl.replace('https://', 'wss://');
        } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
          wsUrl = 'wss://' + wsUrl;
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Connected to server');
          this.reconnectAttempts = 0;

          // Send join message
          this.send({
            type: 'join',
            player: {
              id: this.playerId,
              name: this.playerName,
              gender: this.playerGender,
              x: this.initialX,
              y: this.initialY
            }
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from server');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'players':
        // Initial list of players
        message.players.forEach((player: PlayerState) => {
          if (this.onPlayerJoin) {
            this.onPlayerJoin(player);
          }
        });
        break;

      case 'player-join':
        if (this.onPlayerJoin) {
          this.onPlayerJoin(message.player);
        }
        break;

      case 'player-leave':
        if (this.onPlayerLeave) {
          this.onPlayerLeave(message.playerId);
        }
        break;

      case 'player-move':
        if (this.onPlayerMove) {
          this.onPlayerMove(message.player);
        }
        break;

      case 'chat':
        if (this.onChat) {
          this.onChat(message.playerId, message.name, message.text);
        }
        break;
    }
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  broadcastPosition(x: number, y: number, direction: string, isMoving: boolean): void {
    const now = Date.now();

    // Throttle broadcasts
    if (now - this.lastBroadcast < this.broadcastInterval) {
      return;
    }

    this.lastBroadcast = now;

    this.send({
      type: 'move',
      x,
      y,
      direction,
      isMoving
    });
  }

  sendAction(action: string, data?: any, broadcast: boolean = false): void {
    this.send({
      type: 'action',
      action,
      data,
      broadcast
    });
  }

  sendChat(text: string): void {
    this.send({
      type: 'chat',
      text
    });
  }

  onJoin(callback: PlayerJoinCallback): void {
    this.onPlayerJoin = callback;
  }

  onLeave(callback: PlayerLeaveCallback): void {
    this.onPlayerLeave = callback;
  }

  onMove(callback: PlayerMoveCallback): void {
    this.onPlayerMove = callback;
  }

  onChatMessage(callback: ChatCallback): void {
    this.onChat = callback;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getPlayerId(): string {
    return this.playerId;
  }
}
