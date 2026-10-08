<template>
  <div class="game-container">
    <h1>🃏 P2P "21" Card Game</h1>

    <!-- 接続画面 -->
    <div v-if="!isConnected" class="setup-screen">
      <div class="info-box">
        <p>あなたのPeer ID: <strong class="highlight">{{ myId || '取得中...' }}</strong></p>
        <div v-if="myId" class="invite-box">
          <p class="hint">このURLを相手に送るだけで対戦できます:</p>
          <div class="invite-row">
            <input class="invite-url" readonly :value="inviteUrl" @focus="$event.target.select()" />
            <button class="copy-btn" @click="copyInviteLink">{{ copied ? '✓ コピー済み' : 'リンクをコピー' }}</button>
          </div>
        </div>
      </div>
      <div class="connect-box">
        <input v-model="targetId" placeholder="対戦相手のPeer IDを入力" />
        <button @click="connectToPeer" :disabled="!targetId || isConnecting">
          {{ isConnecting ? '接続中...' : 'ゲストとして接続' }}
        </button>
      </div>
      <p class="hint">※ホストになる場合は、上の招待リンクを相手に送るか、この画面のまま相手からの接続を待ちます。</p>
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
            <span class="turn-label" :key="turnLabel">{{ turnLabel }}</span>
          </p>
        </div>
      </div>

      <!-- ゲームオーバー画面 -->
      <Transition name="overlay">
        <div v-if="gameState.status === 'game-over'" key="game-over" class="overlay">
          <h2>ゲーム終了！</h2>
          <p class="result-text" :class="myState.lives <= 0 ? 'lose' : 'win'">
            {{ myState.lives <= 0 ? 'YOU LOSE...' : 'YOU WIN!!!' }}
          </p>
        </div>

        <!-- ラウンド終了画面 -->
        <div v-else-if="gameState.status === 'round-end'" key="round-end" class="overlay">
          <h2>ラウンド {{ gameState.round }} 終了</h2>
          <p>
            あなたのスコア: {{ calculateScore(myState) }}
            <span v-if="calculateScore(myState) > 21" class="bust-tag">BUST!</span>
          </p>
          <p>
            相手のスコア: {{ calculateScore(opponentState) }}
            <span v-if="calculateScore(opponentState) > 21" class="bust-tag">BUST!</span>
          </p>
          <div v-if="isHost" class="actions mt-4">
            <button @click="startNextRound">次のラウンドへ</button>
          </div>
          <p v-else class="hint">ホストが次のラウンドを開始するのを待っています...</p>
        </div>
      </Transition>

      <div class="battle-field" :class="{ 'blur': gameState.status !== 'playing' }">
        <!-- 相手のエリア -->
        <div class="player-area opponent">
          <div class="area-header">
            <h3>相手</h3>
            <div class="header-right">
              <Transition name="pop">
                <span v-if="opponentState?.passed" class="pass-badge">PASS</span>
              </Transition>
              <span class="lives" :key="opponentState?.lives">LIFE: {{ opponentState?.lives }} / 5</span>
            </div>
            <span class="dmg-layer">
              <span v-for="d in oppDamage" :key="d.id" class="dmg-float">{{ d.amount }}</span>
            </span>
          </div>
          <div class="field-sp">
            <span class="label">展開中のSP:</span>
            <TransitionGroup name="pop" tag="span" class="sp-tag-list">
              <span v-for="card in opponentState?.field" :key="card.id" class="sp-tag">{{ card.name }}</span>
            </TransitionGroup>
          </div>
          <div class="cards-display">
            <div class="hand-row">
              <span class="label">手札:</span>
              <TransitionGroup
                name="deal"
                tag="div"
                class="hand"
                appear
                :style="{ '--deal-y': '130px', '--deal-r': '25deg', '--deal-base': isShuffling ? '550ms' : '0ms' }"
              >
                <PlayingCard
                  v-for="(card, i) in opponentState?.hand"
                  :key="card.id"
                  :value="card.value"
                  :revealed="card.visible || isShowdown"
                  :style="{ '--i': i }"
                />
              </TransitionGroup>
            </div>
            <div class="sp-count">
              SPカード: [ <span class="score-num" :key="opponentState?.spCards.length">{{ opponentState?.spCards.length }}</span> 枚所持 ]
            </div>
          </div>
        </div>

        <!-- 山札（中央） -->
        <div class="divider">
          <div class="deck-wrap">
            <div class="deck" :class="{ shuffling: isShuffling }">
              <span class="deck-count">{{ deckCount }}</span>
            </div>
            <span class="deck-label">DECK</span>
          </div>
        </div>

        <!-- 自分のエリア -->
        <div class="player-area self">
          <div class="area-header">
            <h3>あなた</h3>
            <div class="header-right">
              <Transition name="pop">
                <span v-if="myState?.passed" class="pass-badge">PASS</span>
              </Transition>
              <span class="lives" :key="myState?.lives">LIFE: {{ myState?.lives }} / 5</span>
            </div>
            <span class="dmg-layer">
              <span v-for="d in myDamage" :key="d.id" class="dmg-float">{{ d.amount }}</span>
            </span>
          </div>
          <div class="field-sp">
            <span class="label">展開中のSP:</span>
            <TransitionGroup name="pop" tag="span" class="sp-tag-list">
              <span v-for="card in myState?.field" :key="card.id" class="sp-tag">{{ card.name }}</span>
            </TransitionGroup>
          </div>
          <div class="cards-display">
            <div class="hand-row">
              <span class="label">手札 (計: <strong class="score-num" :key="calculateScore(myState)">{{ calculateScore(myState) }}</strong>):</span>
              <TransitionGroup
                name="deal"
                tag="div"
                class="hand"
                appear
                :style="{ '--deal-y': '-130px', '--deal-r': '-25deg', '--deal-base': isShuffling ? '550ms' : '0ms' }"
              >
                <PlayingCard
                  v-for="(card, i) in myState?.hand"
                  :key="card.id"
                  :value="card.value"
                  :revealed="true"
                  :self-hidden="!card.visible"
                  :style="{ '--i': i }"
                />
              </TransitionGroup>
            </div>
          </div>
          <div class="sp-actions">
            <span class="label">SPカード:</span>
            <TransitionGroup name="pop" tag="span" class="sp-btn-list">
              <button
                v-for="(sp, i) in myState?.spCards"
                :key="sp.id"
                @click="useSpCard(i)"
                :disabled="!isMyTurn || gameState.status !== 'playing'"
                class="sp-btn"
                :title="sp.description"
              >
                {{ sp.name }}
              </button>
            </TransitionGroup>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { TelecomClient } from './lib/TelecomClient.js';
import { Game } from './game/Game.js';
import { SpecialCards } from './game/SpecialCards.js';
import PlayingCard from './components/PlayingCard.vue';

// === 通信・状態管理 ===
const telecom = new TelecomClient();
const myId = ref('');
const targetId = ref('');
const isConnected = ref(false);
const isConnecting = ref(false);
const opponentId = ref('');

// 招待リンク（?join=<PeerID> で自動接続されるURL）
const inviteUrl = computed(() =>
  myId.value ? `${location.origin}${location.pathname}?join=${myId.value}` : '',
);
const copied = ref(false);
let copiedTimer = null;

const isHost = ref(false);
const myPlayerId = computed(() => isHost.value ? 'player1' : 'player2');
const opponentPlayerId = computed(() => isHost.value ? 'player2' : 'player1');

const gameState = ref({});
let gameInstance = null;

const myState = computed(() => gameState.value[myPlayerId.value]);
const opponentState = computed(() => gameState.value[opponentPlayerId.value]);
const isMyTurn = computed(() => gameState.value.currentPlayerId === myPlayerId.value);

// === 演出用の状態 ===

/** ラウンド終了時（ショーダウン）。裏カードを表にめくる演出に使用 */
const isShowdown = computed(() =>
  gameState.value.status === 'round-end' || gameState.value.status === 'game-over',
);

/** 山札の残り枚数（ゲストには値が秘匿され枚数のみ同期される） */
const deckCount = computed(() => gameState.value.deck?.length ?? 0);

const turnLabel = computed(() =>
  gameState.value.status === 'playing'
    ? (isMyTurn.value ? 'あなたのターン' : '相手のターン')
    : 'ラウンド終了',
);

// シャッフル演出：ラウンド開始（初回配札・次ラウンド開始）でデッキを揺らす
const isShuffling = ref(false);
let shuffleTimer = null;
const playShuffle = () => {
  isShuffling.value = true;
  clearTimeout(shuffleTimer);
  shuffleTimer = setTimeout(() => { isShuffling.value = false; }, 1000);
};
watch(() => gameState.value.status, (status, prev) => {
  if (status === 'playing' && prev !== 'playing') playShuffle();
});

// ライフ減少時のダメージポップアップ
const damagePopups = ref([]);
let dmgSeq = 0;
const spawnDamage = (side, amount) => {
  const id = ++dmgSeq;
  damagePopups.value.push({ id, side, amount });
  setTimeout(() => {
    damagePopups.value = damagePopups.value.filter((d) => d.id !== id);
  }, 1500);
};
watch(
  () => [gameState.value.player1?.lives, gameState.value.player2?.lives],
  ([p1, p2], [o1, o2]) => {
    if (o1 != null && p1 != null && p1 < o1) spawnDamage('player1', p1 - o1);
    if (o2 != null && p2 != null && p2 < o2) spawnDamage('player2', p2 - o2);
  },
);
const myDamage = computed(() => damagePopups.value.filter((d) => d.side === myPlayerId.value));
const oppDamage = computed(() => damagePopups.value.filter((d) => d.side === opponentPlayerId.value));

onMounted(async () => {
  try {
    myId.value = await telecom.init();
  } catch (e) {
    console.error('PeerJS初期化エラー:', e);
  }

  // 招待URL（?join=<PeerID>）で開かれた場合はゲストとして自動接続
  const joinId = new URLSearchParams(location.search).get('join');
  if (myId.value && joinId && joinId !== myId.value) {
    targetId.value = joinId;
    connectToPeer();
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
  clearTimeout(shuffleTimer);
  clearTimeout(copiedTimer);
  telecom.destroy();
});

// === メソッド ===

const connectToPeer = async () => {
  isConnecting.value = true;
  try {
    await telecom.connect(targetId.value);
    opponentId.value = targetId.value;
    isConnected.value = true;
    isHost.value = false;
  } catch (e) {
    alert('接続に失敗しました');
  } finally {
    isConnecting.value = false;
  }
};

// 招待リンクのクリップボードコピー（非セキュアコンテキスト用のフォールバック付き）
const copyInviteLink = async () => {
  if (!inviteUrl.value) return;
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = inviteUrl.value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => { copied.value = false; }, 2000);
};

/**
 * ホストからゲストへゲーム状態を同期する。
 * ルール「自分の裏向きのカードは自分しか見えない」を厳密に守るため、
 * プレイ中はホストの裏向きカードの数値を削って送る（チート対策）。
 * ラウンド終了後はショーダウンとして全カードを公開する。
 */
const syncState = () => {
  if (!isHost.value || !gameInstance) return;

  const showdown = gameInstance.status !== 'playing';

  // 1. ホスト自身の画面用の完全なステート
  const fullState = JSON.parse(JSON.stringify(gameInstance));
  gameState.value = fullState;

  // 2. ゲストへ送る用のマスキングされたステート
  const guestState = JSON.parse(JSON.stringify(gameInstance));
  guestState.player1.hand = guestState.player1.hand.map(card =>
    card.visible || showdown ? card : { ...card, value: null } // 相手(ゲスト)にホストの裏カード数値を送らない
  );
  // 山札の中身は秘匿し、残り枚数だけを伝える
  guestState.deck = (guestState.deck || []).map(() => null);

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

button { transition: transform 0.12s ease, background-color 0.2s ease, opacity 0.2s ease; }
button:active:not(:disabled) { transform: scale(0.95); }

/* 接続画面 */
.setup-screen { background: #fafafa; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; animation: screen-in 0.5s ease; }
.info-box { margin-bottom: 2rem; }
.connect-box { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1rem; }
.connect-box input { padding: 0.5rem; width: 60%; border: 1px solid #ccc; border-radius: 4px; transition: border-color 0.2s, box-shadow 0.2s; }
.connect-box input:focus { border-color: #007bff; box-shadow: 0 0 0 3px rgba(0,123,255,0.15); outline: none; }
.connect-box button { padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
.connect-box button:not(:disabled):hover { background: #0069d9; transform: translateY(-1px); }

/* 招待リンク */
.invite-box { margin-top: 1rem; }
.invite-row { display: flex; justify-content: center; gap: 0.5rem; }
.invite-url { padding: 0.5rem; width: 65%; border: 1px solid #ccc; border-radius: 4px; background: #fff; color: #555; font-size: 0.85rem; }
.copy-btn { padding: 0.5rem 1rem; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.copy-btn:not(:disabled):hover { background: #218838; transform: translateY(-1px); }

@keyframes screen-in {
  from { opacity: 0; transform: translateY(16px); }
}

/* ステータスボード */
.status-board { display: flex; justify-content: space-between; background: #333; color: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
.status-left p, .status-right p { margin: 0.2rem 0; }
.turn-indicator { padding: 0.2rem 0.5rem; border-radius: 4px; background: #555; display: inline-block; }
.turn-indicator.active { background: #28a745; font-weight: bold; animation: pulse 1.5s infinite; }
.turn-label { display: inline-block; animation: turn-in 0.35s ease; }

@keyframes turn-in {
  from { opacity: 0; transform: translateY(6px); }
}

/* フィールドとエリア */
.battle-field { position: relative; transition: filter 0.4s ease; }
.battle-field.blur { filter: blur(3px); pointer-events: none; }
.player-area { border: 2px solid #ccc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; position: relative; }
.player-area.opponent { background-color: #fdf5f5; border-color: #ffcccc; }
.player-area.self { background-color: #f0f8ff; border-color: #cce5ff; }

.area-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; margin-bottom: 0.5rem; position: relative; }
.area-header h3 { margin: 0; }
.header-right { display: flex; align-items: center; gap: 0.6rem; }
.lives { font-weight: bold; color: #d9534f; animation: life-flash 0.5s ease; }

@keyframes life-flash {
  30% { transform: scale(1.3); color: #ff1a1a; text-shadow: 0 0 8px rgba(255, 26, 26, 0.6); }
}

/* ダメージポップアップ */
.dmg-layer { position: absolute; right: 0; top: 100%; display: flex; gap: 0.25rem; pointer-events: none; z-index: 5; }
.dmg-float { color: #ff1a1a; font-weight: 900; font-size: 1.4rem; text-shadow: 0 1px 2px #fff; animation: dmg-rise 1.4s ease-out forwards; }

@keyframes dmg-rise {
  0% { opacity: 0; transform: translateY(8px) scale(0.5); }
  20% { opacity: 1; transform: translateY(0) scale(1.15); }
  100% { opacity: 0; transform: translateY(-28px) scale(1); }
}

/* PASSバッジ */
.pass-badge { background: #6c757d; color: #fff; padding: 0.1rem 0.6rem; border-radius: 10px; font-size: 0.75rem; font-weight: bold; letter-spacing: 0.05em; }

/* カードデザイン */
.hand-row { display: flex; align-items: center; }
.hand { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; min-height: 62px; flex: 1; }

/* 自分のカードはホバーで持ち上げる */
.player-area.self .hand .card:hover { transform: translateY(-6px); z-index: 2; }

/* 配札アニメーション（TransitionGroup name="deal"） */
/* .hand > で詳細度を上げ、PlayingCard 側の transition を必ず上書きする */
.hand > .deal-enter-active,
.hand > .deal-appear-active {
  transition: transform 0.5s cubic-bezier(0.2, 0.85, 0.3, 1.1), opacity 0.35s ease;
  /* --deal-base: シャッフル演出が終わってから配り始めるための待機時間。--i: 1枚ずつずらす */
  transition-delay: calc(var(--deal-base, 0ms) + var(--i, 0) * 90ms);
}
.hand > .deal-enter-from,
.hand > .deal-appear-from {
  opacity: 0;
  transform: translateY(var(--deal-y, -130px)) rotate(var(--deal-r, 25deg)) scale(0.35);
}
.hand > .deal-leave-active {
  position: absolute;
  transition: transform 0.35s ease, opacity 0.35s ease;
}
.hand > .deal-leave-to {
  opacity: 0;
  transform: translateY(var(--deal-y, -130px)) rotate(10deg) scale(0.4);
}
.hand > .deal-move { transition: transform 0.45s ease; }

/* SPカードとフィールド */
.field-sp, .sp-actions { margin: 0.5rem 0; position: relative; }
.label { font-size: 0.85rem; color: #555; margin-right: 0.5rem; display: inline-block; width: 80px; }
.sp-tag-list { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
.sp-tag { background: #ffc107; color: #333; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.8rem; }
.sp-btn-list { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; }
.sp-btn { background: #17a2b8; color: #fff; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.sp-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 3px 6px rgba(0,0,0,0.2); }
.sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* SP・フィールド・バッジの出現/消失アニメーション（TransitionGroup/Transition name="pop"） */
.pop-enter-active { transition: transform 0.3s cubic-bezier(0.2, 1.6, 0.4, 1), opacity 0.3s ease; }
.pop-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; position: absolute; }
.pop-enter-from { opacity: 0; transform: scale(0.3); }
.pop-leave-to { opacity: 0; transform: scale(0.5); }
.pop-move { transition: transform 0.3s ease; }

/* スコア・枚数の数字が変わった時のポップ */
.score-num { display: inline-block; animation: score-pop 0.35s ease; }

@keyframes score-pop {
  50% { transform: scale(1.6); color: #d9534f; }
}

/* 山札（中央のDECK） */
.divider { position: relative; border: none; border-top: 1px solid #ddd; margin: 1.4rem 0; height: 0; }
.deck-wrap { position: absolute; left: 50%; top: 0; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 2px; }
.deck {
  position: relative;
  width: 40px;
  height: 56px;
  border-radius: 4px;
  border: 1px solid #333;
  background: repeating-linear-gradient(45deg, #3a6ea5 0px, #3a6ea5 5px, #2c537e 5px, #2c537e 10px);
  box-shadow: 0 0 0 2px #fff inset;
}
/* 重なったカードの厚み表現 */
.deck::before,
.deck::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
  border: 1px solid #333;
  background: repeating-linear-gradient(45deg, #3a6ea5 0px, #3a6ea5 5px, #2c537e 5px, #2c537e 10px);
  z-index: -1;
}
.deck::before { transform: translate(3px, 3px); }
.deck::after { transform: translate(6px, 6px); }

.deck-count {
  position: absolute;
  right: -10px;
  bottom: -10px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  background: #d9534f;
  color: #fff;
  border: 2px solid #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  box-sizing: content-box;
}
.deck-label { font-size: 0.65rem; color: #999; letter-spacing: 0.15em; }

/* シャッフル演出：デッキを左右に分けて揺らす（リフルシャッフル風） */
.deck.shuffling { animation: deck-jiggle 0.5s ease-in-out 2; }
.deck.shuffling::before { animation: riffle-a 0.5s ease-in-out 2; }
.deck.shuffling::after { animation: riffle-b 0.5s ease-in-out 2; }

@keyframes deck-jiggle {
  25% { transform: rotate(-4deg) translateY(-2px); }
  75% { transform: rotate(4deg) translateY(-2px); }
}
@keyframes riffle-a {
  0%, 100% { transform: translate(3px, 3px); }
  50% { transform: translate(-16px, 4px) rotate(-12deg); }
}
@keyframes riffle-b {
  0%, 100% { transform: translate(6px, 6px); }
  50% { transform: translate(18px, 6px) rotate(12deg); }
}

/* メインアクション */
.main-actions { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
.btn-draw { background: #28a745; color: white; border: none; padding: 1rem 2rem; font-size: 1.2rem; border-radius: 8px; cursor: pointer; }
.btn-pass { background: #6c757d; color: white; border: none; padding: 1rem 2rem; font-size: 1.2rem; border-radius: 8px; cursor: pointer; }
.btn-draw:disabled, .btn-pass:disabled { opacity: 0.5; cursor: not-allowed; }
/* 自分のターンはドローボタンが呼吸するように光る */
.btn-draw:not(:disabled) { animation: btn-glow 1.4s ease-in-out infinite; }

@keyframes btn-glow {
  50% { box-shadow: 0 0 16px rgba(40, 167, 69, 0.8); }
}

/* オーバーレイ (ラウンド終了・ゲームオーバー) */
.overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.9); color: white; padding: 2rem 4rem; border-radius: 12px; text-align: center; z-index: 10; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 80%; }
.result-text { font-size: 2rem; font-weight: bold; color: #ffc107; }
.result-text.win { animation: win-glow 0.9s ease-in-out infinite alternate; }
.result-text.lose { color: #aaa; animation: lose-drop 0.5s ease; }
.bust-tag { background: #d9534f; color: #fff; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-left: 0.4rem; animation: pop-tag 0.4s cubic-bezier(0.2, 1.6, 0.4, 1); }

/* オーバーレイの出現/消失 */
.overlay-enter-active { transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.2, 1.3, 0.4, 1); }
.overlay-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.overlay-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
.overlay-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }

@keyframes win-glow {
  from { text-shadow: 0 0 6px rgba(255, 193, 7, 0.6); transform: scale(1); }
  to { text-shadow: 0 0 26px rgba(255, 210, 77, 0.95); transform: scale(1.06); }
}
@keyframes lose-drop {
  from { transform: translateY(-24px); opacity: 0; }
}
@keyframes pop-tag {
  from { transform: scale(0.3); opacity: 0; }
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
</style>
