import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const isLoading = ref(false);
  const loadingMessage = ref('');
  const nickname = ref({ me: '', opponent: '' });
  const isHost = ref(false);

  function startLoading(message) {
    loadingMessage.value = message;
    isLoading.value = true;
  }

  function stopLoading() {
    isLoading.value = false;
    loadingMessage.value = '';
  }

  function setHostFlag(value) {
    isHost.value = value;
  }

  return {
    isLoading,
    loadingMessage,
    nickname,
    isHost,
    startLoading,
    stopLoading,
    setHostFlag,
  };
});
