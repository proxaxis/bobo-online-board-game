export type SPCardKind = 'consume' | 'field';

export interface SPCard {
  key: string;
  name: string;
  kind: SPCardKind;
  description: string;
  effect: string;
}

export interface Card {
  value: number;
  visible: boolean;
}

export interface Player {
  id: 'player1' | 'player2';
  lives: number;
  hand: Card[];
  spCards: SPCard[];
  field: SPCard[];
  passed: boolean;
}

export type GameStatus = 'playing' | 'round-end' | 'game-over';
export type ActionType = 'draw' | 'pass';

export interface PlaySpOptions {
  targetValue?: number; // ドローカードの指定用
}
