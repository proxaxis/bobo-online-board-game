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
  visible: boolean; // 相手に見えているかどうか
}

export interface Player {
  id: 'player1' | 'player2';
  lives: number;       // 機（初期値5）
  hand: Card[];        // 手札
  spCards: SPCard[];   // 所持しているSPカード
  field: SPCard[];     // 場に出ているSPカード（最大5枚）
  passed: boolean;     // パスしたかどうか
}

export type GameStatus = 'playing' | 'round-end' | 'game-over';
export type ActionType = 'draw' | 'pass';

export interface PlaySpOptions {
  targetValue?: number; // 「ドロー 1～11」などで指定する値
}
