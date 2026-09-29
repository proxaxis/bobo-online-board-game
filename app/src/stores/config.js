import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const useConfigStore = defineStore('config', () => {
  const data = {
    initialHiddenCards: ref(1),
    initialFaceUpCards: ref(1),
    initialLives: ref(3),
    maxTurnsPerRound: ref(3),
    maxFieldCards: ref(5),
  };

  const initialHandSize = computed(() => data.initialHiddenCards.value + data.initialFaceUpCards.value);

  return {
    ...data,
    initialHandSize,
  };
});
