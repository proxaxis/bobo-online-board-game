import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { generateId } from '@/lib/uuid.js';

function createDeck() {
  return Array.from({ length: 11 }, (_, index) => ({
    id: generateId('card'),
    value: index + 1,
    owner: null,
    faceUp: false,
  }));
}

function shuffle(items) {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function defaultState() {
  return {
    round: 1,
    turn: 0,
    firstPlayer: 0,
    deck: [],
    spDeck: [],
    hands: [[], []],
    spHands: [[], []],
    fieldCards: [[], []],
    lives: [5, 5],
    phase: 'lobby',
    resultMessage: '',
    winner: null,
    logs: [],
  };
}

function sumCards(cards) {
  return cards.reduce((total, card) => total + Number(card.value || 0), 0);
}

function compareCloseTo21(a, b) {
  const aBust = a > 21;
  const bBust = b > 21;

  if (a === b) return 'draw';
  if (aBust && bBust) return a < b ? 'host' : 'opponent';
  if (aBust) return 'opponent';
  if (bBust) return 'host';
  return a > b ? 'host' : 'opponent';
}

function deriveWinnerLabel(totalA, totalB) {
  const aBust = totalA > 21;
  const bBust = totalB > 21;

  if (totalA === totalB) return 'draw';
  if (aBust && bBust) return totalA < totalB ? 'host' : 'opponent';
  if (aBust) return 'opponent';
  if (bBust) return 'host';
  return totalA > totalB ? 'host' : 'opponent';
}

export const useGameStore = defineStore('game', () => {
  const state = ref(defaultState());
  const nickname = ref(['Host', 'Opponent']);
  const myIndex = ref(0);

  const isHost = computed(() => myIndex.value === 0);
  const isClient = computed(() => myIndex.value === 1);
  const currentTurnPlayer = computed(() => {
    const order = state.value.firstPlayer === 0 ? [0, 1] : [1, 0];
    return order[state.value.turn % 2];
  });
  const isMyTurn = computed(() => state.value.phase === 'playing' && currentTurnPlayer.value === myIndex.value);

  function setLocalRole(role) {
    myIndex.value = role === 'host' ? 0 : 1;
  }

  function setMyName(name) {
    nickname.value[myIndex.value] = name || (myIndex.value === 0 ? 'Host' : 'Opponent');
  }

  function resetState() {
    state.value = defaultState();
  }

  function addLog(message) {
    state.value.logs.unshift({
      id: generateId('log'),
      text: message,
    });
  }

  function drawCardFor(playerIndex, faceUp = true) {
    const nextCard = state.value.deck.shift();
    if (!nextCard) return null;

    const card = {
      ...nextCard,
      owner: playerIndex,
      faceUp,
    };

    state.value.hands[playerIndex].push(card);
    addLog(`${nickname.value[playerIndex]} drew ${card.value}`);
    return card;
  }

  function serializeState() {
    return JSON.parse(JSON.stringify(state.value));
  }

  function hydrateState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    state.value = {
      ...defaultState(),
      ...snapshot,
      hands: Array.isArray(snapshot.hands) ? snapshot.hands : [[], []],
      spHands: Array.isArray(snapshot.spHands) ? snapshot.spHands : [[], []],
      fieldCards: Array.isArray(snapshot.fieldCards) ? snapshot.fieldCards : [[], []],
      lives: Array.isArray(snapshot.lives) ? snapshot.lives : [5, 5],
      logs: Array.isArray(snapshot.logs) ? snapshot.logs : [],
    };
  }

  function startRound() {
    resetState();
    state.value.lives = [5, 5];
    state.value.round = 1;
    state.value.phase = 'playing';
    state.value.firstPlayer = Math.random() < 0.5 ? 0 : 1;
    state.value.turn = 0;
    state.value.deck = shuffle(createDeck());
    state.value.spDeck = [];
    for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
      drawCardFor(playerIndex, true);
      drawCardFor(playerIndex, false);
    }
    addLog(`Round ${state.value.round} begins.`);
  }

  function startMatch() {
    startRound();
  }

  function resolveRound() {
    const totals = state.value.hands.map((cards) => sumCards(cards));
    const result = deriveWinnerLabel(totals[0], totals[1]);

    if (result === 'draw') {
      state.value.phase = 'round-over';
      state.value.winner = null;
      state.value.resultMessage = 'Draw. No life changes.';
      return true;
    }

    const winnerIndex = result === 'host' ? 0 : 1;
    const loserIndex = winnerIndex === 0 ? 1 : 0;

    state.value.phase = 'round-over';
    state.value.winner = winnerIndex;
    state.value.resultMessage = `${nickname.value[winnerIndex]} wins round ${state.value.round}.`;

    const penalty = state.value.round;
    state.value.lives[loserIndex] = Math.max(state.value.lives[loserIndex] - penalty, 0);

    if (state.value.lives[loserIndex] <= 0) {
      state.value.phase = 'game-over';
      state.value.resultMessage = `${nickname.value[winnerIndex]} wins the game.`;
    }

    return true;
  }

  function applyAction(action) {
    if (!action || state.value.phase !== 'playing') return false;

    const playerIndex = Number(action.player ?? myIndex.value);
    if (playerIndex !== currentTurnPlayer.value) return false;

    if (action.type === 'draw') {
      const card = drawCardFor(playerIndex, true);
      if (!card) return false;
      state.value.turn += 1;
      if (state.value.turn >= 8) resolveRound();
      return true;
    }

    if (action.type === 'pass') {
      state.value.turn += 1;
      addLog(`${nickname.value[playerIndex]} passed.`);
      if (state.value.turn >= 8) resolveRound();
      return true;
    }

    return false;
  }

  function startNextRound() {
    if (state.value.phase !== 'round-over' && state.value.phase !== 'game-over') return false;
    if (state.value.phase === 'game-over') return false;

    state.value.round += 1;
    state.value.turn = 0;
    state.value.firstPlayer = Math.random() < 0.5 ? 0 : 1;
    state.value.hands = [[], []];
    state.value.spHands = [[], []];
    state.value.fieldCards = [[], []];
    state.value.resultMessage = '';
    state.value.logs = [];
    state.value.deck = shuffle(createDeck());
    state.value.phase = 'playing';

    for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
      drawCardFor(playerIndex, true);
      drawCardFor(playerIndex, false);
    }
    addLog(`Round ${state.value.round} begins.`);
    return true;
  }

  return {
    state,
    nickname,
    myIndex,
    isHost,
    isClient,
    isMyTurn,
    currentTurnPlayer,
    setLocalRole,
    setMyName,
    resetState,
    drawCardFor,
    serializeState,
    hydrateState,
    startRound,
    startMatch,
    startNextRound,
    resolveRound,
    applyAction,
  };
});
