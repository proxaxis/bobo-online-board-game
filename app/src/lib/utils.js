import { generateId } from '@/lib/uuid.js';
import { specials } from '@/assets/specials.js';

export function getRandomItem(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

export function shuffle(items) {
  const arr = [...items];
  for (let index = arr.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [arr[index], arr[swapIndex]] = [arr[swapIndex], arr[index]];
  }
  return arr;
}

export function createSpDeck() {
  const cards = [];
  for (let copy = 0; copy < 3; copy += 1) {
    specials.forEach((card) => {
      cards.push({
        id: generateId('sp'),
        key: card.key,
        name: card.name,
        kind: card.kind,
        description: card.description,
        effect: card.effect,
      });
    });
  }
  return shuffle(cards);
}

export function cloneCard(card) {
  return { ...card };
}

export function clonePlayerCards(cards) {
  return cards.map(cloneCard);
}

export function sumCards(cards) {
  return cards.reduce((total, card) => total + Number(card.value || 0), 0);
}

export function judgeRound(hostTotal, opponentTotal) {
  const hostBust = hostTotal > 21;
  const opponentBust = opponentTotal > 21;

  if (hostTotal === opponentTotal) return 'draw';
  if (hostBust && opponentBust) {
    return hostTotal < opponentTotal ? 'host' : 'opponent';
  }
  if (hostBust) return 'opponent';
  if (opponentBust) return 'host';
  return hostTotal > opponentTotal ? 'host' : 'opponent';
}
