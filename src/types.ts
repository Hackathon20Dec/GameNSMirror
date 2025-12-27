export type Gender = 'male' | 'female';

export interface PlayerData {
  name: string;
  gender: Gender;
  skinIndex?: number;
}

export interface GameData {
  player: PlayerData;
}

export interface PlayerState {
  id: string;
  name: string;
  gender: Gender;
  x: number;
  y: number;
  direction: string;
  isMoving: boolean;
}
