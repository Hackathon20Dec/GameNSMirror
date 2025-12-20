export type Gender = 'male' | 'female';

export interface PlayerData {
  name: string;
  gender: Gender;
}

export interface GameData {
  player: PlayerData;
}
