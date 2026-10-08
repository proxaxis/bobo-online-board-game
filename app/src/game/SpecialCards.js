/**
 * @typedef {import('@/game/SpecialCards.d.ts').SPCard} SPCard
 * @typedef {import('@/game/SpecialCards.d.ts').Player} Player
 * @typedef {import('@/game/SpecialCards.d.ts').PlaySpOptions} PlaySpOptions
 */

import { generateId } from '@/lib/uuid.js';

export class SpecialCards {
  /**
   * SPカードの全定義（マスターデータ）
   * @type {SPCard[]}
   */
  static DEFINITIONS = [
    { key: 'draw-value', name: 'ドロー 1～11', kind: 'consume', description: '山札に残っている値のカードを1枚引く。', effect: 'draw-value' },
    { key: 'remove-last', name: 'リムーブ', kind: 'consume', description: '相手が最後に引いた表向きのカードを山札に戻す。', effect: 'remove-last' },
    { key: 'destroy-field', name: 'デストロイ', kind: 'consume', description: '相手が最後に場に置いたSPカードを取り除く。', effect: 'destroy-last-field' },
    { key: 'destroy-all', name: 'デストロイ+', kind: 'consume', description: '相手が場に置いたSPカードをすべて取り除く。', effect: 'destroy-all-field' },
    { key: 'perfect-draw', name: 'パーフェクトドロー', kind: 'consume', description: '山札の中から一番良い数字のカードを引く。', effect: 'perfect-draw' },
    { key: 'perfect-draw-field', name: 'パーフェクトドロー+', kind: 'field', description: '最良のカードを引き、相手の賭け数を5増やす。', effect: 'perfect-draw-plus' },
    { key: 'ultimate-draw', name: 'アルティメットドロー', kind: 'consume', description: '最良のカードを引き、さらにSPカードを2枚引く。', effect: 'ultimate-draw' },
    { key: 'bet-up-1', name: 'ベットアップ1', kind: 'field', description: 'SPカードを1枚引き、相手の賭け数を1増やす。', effect: 'bet-up-1' },
    { key: 'bet-up-2', name: 'ベットアップ2', kind: 'field', description: 'SPカードを1枚引き、相手の賭け数を2増やす。', effect: 'bet-up-2' },
    { key: 'bet-up-2-plus', name: 'ベットアップ2+', kind: 'field', description: '最後に引いた表向きカードを戻し、相手の賭け数を2増やす。', effect: 'bet-up-2-plus' },
    { key: 'shield', name: 'シールド', kind: 'field', description: '場に置かれている間、自分の賭け数を1減らす。', effect: 'shield' },
    { key: 'shield-plus', name: 'シールド+', kind: 'field', description: '場に置かれている間、自分の賭け数を2減らす。', effect: 'shield-plus' },
    { key: 'sp-change', name: 'SPチェンジ', kind: 'consume', description: '自分のSPカードをランダムで2枚捨て、3枚引く。', effect: 'sp-change' },
    { key: 'sp-change-plus', name: 'SPチェンジ+', kind: 'consume', description: '自分のSPカードをランダムで1枚捨て、4枚引く。', effect: 'sp-change-plus' },
  ];

  /**
   * ランダムにSPカードを生成して返す
   * @param {number} count
   * @returns {SPCard[]}
   */
  static drawRandom(count = 1) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const sp = this.DEFINITIONS[Math.floor(Math.random() * this.DEFINITIONS.length)];
      drawn.push({ ...sp, id: generateId('sp') });
    }
    return drawn;
  }

  /**
   * SPカードの効果を解決し、プレイヤーや山札の状態を更新する
   * @param {SPCard} spCard
   * @param {Player} player
   * @param {Player} opponent
   * @param {number[]} deck
   * @param {PlaySpOptions} options
   */
  static applyEffect(spCard, player, opponent, deck, options = {}) {
    switch (spCard.effect) {
      case 'draw-value':
        if (options.targetValue) {
          const idx = deck.indexOf(options.targetValue);
          if (idx !== -1) {
            player.hand.push({ id: generateId('c'), value: deck.splice(idx, 1)[0], visible: true });
          }
        }
        break;

      case 'remove-last':
      case 'bet-up-2-plus':
        for (let i = opponent.hand.length - 1; i >= 0; i--) {
          if (opponent.hand[i].visible) {
            const removed = opponent.hand.splice(i, 1)[0];
            deck.push(removed.value); // 山札に戻す
            break;
          }
        }
        break;

      case 'destroy-last-field':
        if (opponent.field.length > 0) opponent.field.pop();
        break;

      case 'destroy-all-field':
        opponent.field = [];
        break;

      case 'perfect-draw':
      case 'perfect-draw-plus':
      case 'ultimate-draw':
        this._executePerfectDraw(player, deck);
        if (spCard.effect === 'ultimate-draw') {
          player.spCards.push(...this.drawRandom(2));
        }
        break;

      case 'bet-up-1':
      case 'bet-up-2':
        player.spCards.push(...this.drawRandom(1));
        break;

      case 'sp-change':
        this._discardRandom(player, 2);
        player.spCards.push(...this.drawRandom(3));
        break;

      case 'sp-change-plus':
        this._discardRandom(player, 1);
        player.spCards.push(...this.drawRandom(4));
        break;

      case 'shield':
      case 'shield-plus':
        // 場に出る系のパッシブ効果はダメージ計算時に評価される
        break;
    }
  }

  // --- Private Helper Methods ---

  /**
   * @private
   * @param {Player} player
   * @param {number[]} deck
   */
  static _executePerfectDraw(player, deck) {
    if (deck.length === 0) return;
    const currentScore = player.hand.reduce((sum, card) => sum + card.value, 0);

    let bestValue = deck[0];
    let minDiff = Infinity;

    for (const val of deck) {
      const diff = 21 - (currentScore + val);
      if (diff >= 0 && diff < minDiff) {
        minDiff = diff;
        bestValue = val;
      }
    }

    if (minDiff === Infinity) {
      bestValue = Math.min(...deck); // バースト回避不能なら最小のダメージを選ぶ
    }

    const idx = deck.indexOf(bestValue);
    player.hand.push({ id: generateId('c'), value: deck.splice(idx, 1)[0], visible: true });
  }

  /**
   * @private
   * @param {Player} player
   * @param {number} count
   */
  static _discardRandom(player, count) {
    for (let i = 0; i < count; i++) {
      if (player.spCards.length === 0) break;
      const idx = Math.floor(Math.random() * player.spCards.length);
      player.spCards.splice(idx, 1);
    }
  }
}
