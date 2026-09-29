<template>
  <div class="game-container">
    <h1>🃏 P2P "21" Card Game</h1>

    <!-- 接続画面 -->
    <div v-if="!isConnected" class="setup-screen">
      <div class="info-box">
        <p>あなたのPeer ID: <strong class="highlight">{{ myId || '取得中...' }}</strong></p>
      </div>
      <div class="connect-box">
        <input v-model="targetId" placeholder="対戦相手のPeer IDを入力" />
        <button @click="connectToPeer" :disabled="!targetId">ゲストとして接続</button>
      </div>
      <p class="hint">※ホストになる場合は、この画面のまま相手からの接続を待ちます。</p>
    </div>

    <!-- ゲーム画面 -->
    <div v-else class="play-screen">
      <!-- ヘッダー情報 -->
      <div class="status-board">
        <div class="status-left">
          <p>ラウンド: <strong>{{ gameState.round }}</strong> (基本賭け数: {{ gameState.round }})</p>
          <p>ターン: <strong>{{ Math.floor(gameState.turnCount / 2) + 1 }} / 4</strong> (総アクション: {{ gameState.turnCount }}/8)</p>
        </div>
        <div class="status-right">
          <p>あなたは <strong>{{ isHost ? 'Player 1 (Host)' : 'Player 2 (Guest)' }}</strong></p>
          <p class="turn-indicator" :class="{ active: isMyTurn && gameState.status === 'playing' }">
            {{ gameState.status === 'playing' ? (isMyTurn ? 'あなたのターン' : '相手のターン') : 'ラウンド終了' }}
          </p>
        </div>
      </div>

      <!-- ゲームオーバー画面 -->
      <div v-if="gameState.status === 'game-over'" class="overlay">
        <h2>ゲーム終了！</h2>
        <p class="result-text">{{ myState.lives <= 0 ? 'YOU LOSE...' : 'YOU WIN!!!' }}</p>
      </div>

      <!-- ラウンド終了画面 -->
      <div v-else-if="gameState.status === 'round-end'" class="overlay">
        <h2>ラウンド {{ gameState.round }} 終了</h2>
        <p>あなたのスコア: {{ calculateScore(myState) }}</p>
        <p>相手のスコア: {{ calculateScore(opponentState) }}</p>
        <div v-if="isHost" class="actions mt-4">
          <button @click="startNextRound">次のラウンドへ</button>
        </div>
        <p v-else class="hint">ホストが次のラウンドを開始するのを待っています...</p>
      </div>

      <div class="battle-field" :class="{ 'blur': gameState.status !== 'playing' }">
        <!-- 相手のエリア -->
        <div class="player-area opponent">
          <div class="area-header">
            <h3>相手</h3>
            <span class="lives">LIFE: {{ opponentState?.lives }} / 5</span>
          </div>
          <div class="field-sp">
            <span class="label">展開中のSP:</span>
            <span v-for="(card, i) in opponentState?.field" :key="i" class="sp-tag">{{ card.name }}</span>
          </div>
          <div class="cards-display">
            <div class="hand">
              <span class="label">手札:</span>
              <span v-for="(card, i) in opponentState?.hand" :key="i" class="card" :class="{ hidden: !card.visible }">
                {{ card.visible ? card.value : '?' }}
              </span>
            </div>
            <div class="sp-count">
              SPカード: [ {{ opponentState?.spCards.length }} 枚所持 ]
            </div>
          </div>
        </div>

        <hr class="divider" />

        <!-- 自分のエリア -->
        <div class="player-area self">
          <div class="area-header">
            <h3>あなた</h3>
            <span class="lives">LIFE: {{ myState?.lives }} / 5</span>
          </div>
          <div class="field-sp">
            <span class="label">展開中のSP:</span>
            <span v-for="(card, i) in myState?.field" :key="i" class="sp-tag">{{ card.name }}</span>
          </div>
          <div class="cards-display">
            <div class="hand">
              <span class="label">手札 (計: {{ calculateScore(myState) }}):</span>
              <!-- 自分の手札は裏向き(visible=false)でも数字が見えるようにする -->
              <span v-for="(card, i) in myState?.hand" :key="i" class="card" :class="{ 'my-hidden': !card.visible }">
                {{ card.value }}
              </span>
            </div>
          </div>
          <div class="sp-actions">
            <span class="label">SPカード:</span>
            <button
              v-for="(sp, i) in myState?.spCards"
              :key="i"
              @click="useSpCard(i)"
              :disabled="!isMyTurn || gameState.status !== 'playing'"
              class="sp-btn"
              :title="sp.description"
            >
              {{ sp.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- アクションボタン -->
      <div class="actions main-actions" v-if="gameState.status === 'playing'">
        <button class="btn-draw" @click="takeAction('draw')" :disabled="!isMyTurn">カードを引く</button>
        <button class="btn-pass" @click="takeAction('pass')" :disabled="!isMyTurn">パスする</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { TelecomClient } from './lib/TelecomClient.js';
import { Game } from './game/Game.js';
import { SpecialCards } from './game/SpecialCards.js';

// === 通信・状態管理 ===
const telecom = new TelecomClient();
const myId = ref('');
const targetId = ref('');
const isConnected = ref(false);
const opponentId = ref('');

const isHost = ref(false);
const myPlayerId = computed(() => isHost.value ? 'player1' : 'player2');
const opponentPlayerId = computed(() => isHost.value ? 'player2' : 'player1');

const gameState = ref({});
let gameInstance = null;

const myState = computed(() => gameState.value[myPlayerId.value]);
const opponentState = computed(() => gameState.value[opponentPlayerId.value]);
const isMyTurn = computed(() => gameState.value.currentPlayerId === myPlayerId.value);

onMounted(async () => {
  try {
    myId.value = await telecom.init();
  } catch (e) {
    console.error('PeerJS初期化エラー:', e);
  }

  // 相手から接続された時（自分がホストになる）
  telecom.addEventListener('CON_CONNECTED', (e) => {
    opponentId.value = e.detail.peerId;
    isConnected.value = true;
    isHost.value = true;

    gameInstance = new Game();
    gameInstance.startRound();
    gameInstance.player1.spCards = SpecialCards.drawRandom(2);
    gameInstance.player2.spCards = SpecialCards.drawRandom(2);
    syncState();
  });

  // 状態の受信（ゲストとして状態を受け取る）
  telecom.onMessage('sync-state', (payload) => {
    gameState.value = payload;
  });

  // アクションの受信（ホストとして相手のアクションを受け取る）
  telecom.onMessage('action', (payload) => {
    if (!isHost.value) return;
    try {
      if (payload.type === 'take-action') {
        gameInstance.takeAction('player2', payload.action);
      } else if (payload.type === 'use-sp') {
        // ※「ドロー1〜11」などの対象指定が必要なカードの場合、payload.options を渡す拡張がここに必要になります
        gameInstance.useSpCard('player2', payload.index, payload.options || {});
      }
      syncState();
    } catch (err) {
      alert(`エラー: ${err.message}`);
    }
  });

  telecom.addEventListener('CON_DISCONNECTED', () => {
    alert('相手との通信が切断されました');
    isConnected.value = false;
  });
});

onUnmounted(() => {
  telecom.destroy();
});

// === メソッド ===

const connectToPeer = async () => {
  try {
    await telecom.connect(targetId.value);
    opponentId.value = targetId.value;
    isConnected.value = true;
    isHost.value = false;
  } catch (e) {
    alert('接続に失敗しました');
  }
};

/**
 * ホストからゲストへゲーム状態を同期する。
 * ルール「自分の裏向きのカードは自分しか見えない」を厳密に守るため、
 * 通信のペイロードからホストの裏向きカードの数値を削って送る（チート対策）
 */
const syncState = () => {
  if (!isHost.value || !gameInstance) return;

  // 1. ホスト自身の画面用の完全なステート
  const fullState = JSON.parse(JSON.stringify(gameInstance));
  gameState.value = fullState;

  // 2. ゲストへ送る用のマスキングされたステート
  const guestState = JSON.parse(JSON.stringify(gameInstance));
  guestState.player1.hand = guestState.player1.hand.map(card =>
    card.visible ? card : { ...card, value: null } // 相手(ゲスト)にホストの裏カード数値を送らない
  );

  telecom.to(opponentId.value, 'sync-state', guestState);
};

const takeAction = (action) => {
  if (isHost.value) {
    try {
      gameInstance.takeAction('player1', action);
      syncState();
    } catch (e) { alert(e.message); }
  } else {
    telecom.to(opponentId.value, 'action', { type: 'take-action', action });
  }
};

const useSpCard = (index) => {
  // ※実際のゲームでは「ドロー1〜11」を使った際に prompt等で数字を入力させ、options に詰める処理が入ります
  const options = {};
  const spCard = myState.value.spCards[index];

  if (spCard.effect === 'draw-value') {
    const val = prompt('山札から引きたい数字(1〜11)を入力してください:');
    if (!val) return; // キャンセル
    options.targetValue = parseInt(val, 10);
  }

  if (isHost.value) {
    try {
      gameInstance.useSpCard('player1', index, options);
      syncState();
    } catch (e) { alert(e.message); }
  } else {
    telecom.to(opponentId.value, 'action', { type: 'use-sp', index, options });
  }
};

const startNextRound = () => {
  if (!isHost.value) return;
  gameInstance.startRound();
  // ルール外ですが、ラウンド毎にSPカードを1枚補充する仕様にしています
  gameInstance.player1.spCards.push(...SpecialCards.drawRandom(1));
  gameInstance.player2.spCards.push(...SpecialCards.drawRandom(1));
  syncState();
};

const calculateScore = (playerState) => {
  if (!playerState || !playerState.hand) return 0;
  return playerState.hand.reduce((sum, card) => sum + (card.value || 0), 0);
};
</script>

<style scoped>
/* 全体のスタイリング */
.game-container { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 1rem; color: #333; }
.highlight { color: #d9534f; font-size: 1.2rem; }
.hint { font-size: 0.85rem; color: #777; }
.mt-4 { margin-top: 1rem; }

/* 接続画面 */
.setup-screen { background: #fafafa; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
.info-box { margin-bottom: 2rem; }
.connect-box { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1rem; }
.connect-box input { padding: 0.5rem; width: 60%; border: 1px solid #ccc; border-radius: 4px; }
.connect-box button { padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }

/* ステータスボード */
.status-board { display: flex; justify-content: space-between; background: #333; color: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
.status-left p, .status-right p { margin: 0.2rem 0; }
.turn-indicator { padding: 0.2rem 0.5rem; border-radius: 4px; background: #555; display: inline-block; }
.turn-indicator.active { background: #28a745; font-weight: bold; animation: pulse 1.5s infinite; }

/* フィールドとエリア */
.battle-field { position: relative; }
.battle-field.blur { filter: blur(3px); pointer-events: none; }
.player-area { border: 2px solid #ccc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; position: relative; }
.player-area.opponent { background-color: #fdf5f5; border-color: #ffcccc; }
.player-area.self { background-color: #f0f8ff; border-color: #cce5ff; }

.area-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
.area-header h3 { margin: 0; }
.lives { font-weight: bold; color: #d9534f; }

/* カードデザイン */
.card { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 60px; border: 1px solid #333; margin-right: 0.5rem; background: #fff; font-weight: bold; font-size: 1.2rem; border-radius: 4px; box-shadow: 1px 1px 3px rgba(0,0,0,0.2); }
.card.hidden { background: #555; color: #555; } /* 相手の裏向き */
.card.my-hidden { background: #e0e0e0; color: #555; border-style: dashed; } /* 自分の裏向き（数字は見える） */

/* SPカードとフィールド */
.field-sp, .sp-actions { margin: 0.5rem 0; }
.label { font-size: 0.85rem; color: #555; margin-right: 0.5rem; display: inline-block; width: 80px; }
.sp-tag { background: #ffc107; color: #333; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin-right: 0.3rem; }
.sp-btn { background: #17a2b8; color: #fff; border: none; padding: 0.4rem 0.8rem; margin-right: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* メインアクション */
.main-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
.btn-draw { background: #28a745; color: white; border: none; padding: 1rem 2rem; font-size: 1.2rem; border-radius: 8px; cursor: pointer; }
.btn-pass { background: #6c757d; color: white; border: none; padding: 1rem 2rem; font-size: 1.2rem; border-radius: 8px; cursor: pointer; }
.btn-draw:disabled, .btn-pass:disabled { opacity: 0.5; cursor: not-allowed; }

/* オーバーレイ (ラウンド終了・ゲームオーバー) */
.overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.9); color: white; padding: 2rem 4rem; border-radius: 12px; text-align: center; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 80%; }
.result-text { font-size: 2rem; font-weight: bold; color: #ffc107; }

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>
