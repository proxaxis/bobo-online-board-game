// Game.js
import { SpecialCards } from './SpecialCards.js';
import { generateId } from '@/lib/uuid.js';

/**
 * @typedef {import('@/game/Game.d.ts').Player} Player
 * @typedef {import('@/game/Game.d.ts').GameStatus} GameStatus
 * @typedef {import('@/game/Game.d.ts').ActionType} ActionType
 * @typedef {import('@/game/Game.d.ts').PlaySpOptions} PlaySpOptions
 */

export class Game {
  constructor() {
    /** @type {Player} */
    this.player1 = this._createPlayer('player1');
    /** @type {Player} */
    this.player2 = this._createPlayer('player2');

    /** @type {number[]} */
    this.deck = [];

    this.round = 1;
    this.turnCount = 0;

    /** @type {'player1' | 'player2'} */
    this.currentPlayerId = 'player1';

    /** @type {GameStatus} */
    this.status = 'playing';
  }

  /** @private */
  _createPlayer(id) {
    return { id, lives: 5, hand: [], spCards: [], field: [], passed: false };
  }

  startRound() {
    if (this.status === 'game-over') throw new Error('Game is already over.');
    if (this.status === 'round-end') this.round++;

    this.deck = Array.from({ length: 11 }, (_, i) => i + 1);
    this.player1.hand = [];
    this.player2.hand = [];
    this.player1.field = [];
    this.player2.field = [];
    this.player1.passed = false;
    this.player2.passed = false;
    this.turnCount = 0;
    this.status = 'playing';

    // ゲーム開始時は交互に2枚（表、裏）引く
    this._drawCard(this.player1, true);
    this._drawCard(this.player2, true);
    this._drawCard(this.player1, false);
    this._drawCard(this.player2, false);

    this.currentPlayerId = 'player1';
  }

  /**
   * @param {'player1' | 'player2'} playerId
   * @param {ActionType} action
   */
  takeAction(playerId, action) {
    this._validateTurn(playerId);
    const player = this._getPlayer(playerId);

    if (action === 'draw') {
      if (this.deck.length > 0) this._drawCard(player, true);
    } else if (action === 'pass') {
      player.passed = true;
    }

    this.turnCount++;
    this._advanceTurn();
  }

  /**
   * @param {'player1' | 'player2'} playerId
   * @param {number} spCardIndex - 使用する手札のSPカードインデックス
   * @param {PlaySpOptions} [options]
   */
  useSpCard(playerId, spCardIndex, options = {}) {
    this._validateTurn(playerId);
    const player = this._getPlayer(playerId);
    const opponent = this._getOpponent(playerId);

    const spCard = player.spCards[spCardIndex];
    if (!spCard) throw new Error('Invalid SP Card index.');

    if (spCard.kind === 'field' && player.field.length >= 5) {
      throw new Error('Field is full (max 5 cards).');
    }

    // 使用したので手札から削除
    player.spCards.splice(spCardIndex, 1);

    if (spCard.kind === 'field') {
      player.field.push(spCard);
    }

    // 複雑なカードの効果解決は SpecialCards クラスへ完全に移譲
    SpecialCards.applyEffect(spCard, player, opponent, this.deck, options);
  }

  resolveRound() {
    this.status = 'round-end';

    const score1 = this._calculateScore(this.player1);
    const score2 = this._calculateScore(this.player2);
    const diff1 = score1 - 21;
    const diff2 = score2 - 21;

    let winnerId = null;

    if (diff1 <= 0 && diff2 <= 0) {
      if (diff1 > diff2) winnerId = 'player1';
      else if (diff2 > diff1) winnerId = 'player2';
    } else if (diff1 > 0 && diff2 > 0) {
      if (diff1 < diff2) winnerId = 'player1';
      else if (diff2 < diff1) winnerId = 'player2';
    } else {
      winnerId = diff1 <= 0 ? 'player1' : 'player2';
    }

    if (winnerId) {
      const loser = this._getPlayer(winnerId === 'player1' ? 'player2' : 'player1');
      const winner = this._getPlayer(winnerId);
      loser.lives -= this._calculateDamage(loser, winner);
    }

    if (this.player1.lives <= 0 || this.player2.lives <= 0) {
      this.status = 'game-over';
    }

    return { winnerId, score1, score2, p1Lives: this.player1.lives, p2Lives: this.player2.lives };
  }

  // --- Private Control Methods ---

  /** @private */
  _getPlayer(id) { return id === 'player1' ? this.player1 : this.player2; }
  /** @private */
  _getOpponent(id) { return id === 'player1' ? this.player2 : this.player1; }

  /** @private */
  _validateTurn(playerId) {
    if (this.status !== 'playing') throw new Error('Game is not active.');
    if (this.currentPlayerId !== playerId) throw new Error('Not your turn.');
  }

  /** @private */
  _advanceTurn() {
    if (this.turnCount >= 8) {
      this.resolveRound();
    } else {
      this.currentPlayerId = this.currentPlayerId === 'player1' ? 'player2' : 'player1';
    }
  }

  /** @private */
  _calculateScore(player) {
    return player.hand.reduce((sum, card) => sum + card.value, 0);
  }

  /** @private */
  _drawCard(player, visible) {
    if (this.deck.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.deck.length);
    const value = this.deck.splice(randomIndex, 1)[0];
    const card = { id: generateId('c'), value, visible };
    player.hand.push(card);
    return card;
  }

  /** @private */
  _calculateDamage(loser, winner) {
    let damage = this.round;
    winner.field.forEach(sp => {
      if (sp.effect === 'bet-up-1') damage += 1;
      if (sp.effect === 'bet-up-2' || sp.effect === 'bet-up-2-plus') damage += 2;
      if (sp.effect === 'perfect-draw-plus') damage += 5;
    });
    loser.field.forEach(sp => {
      if (sp.effect === 'shield') damage -= 1;
      if (sp.effect === 'shield-plus') damage -= 2;
    });
    return Math.max(0, damage);
  }
}
