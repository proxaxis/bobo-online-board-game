<script setup>
const props = defineProps({
  text: {
    type: String,
    default: null,
  },
});
</script>

<template>
  <figure class="loading-spinner">
    <div class="spinner"></div>
    <p v-if="text">{{ text }}</p>
  </figure>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as var;

.loading-spinner {
  display: grid;
  place-items: center;

  .spinner {
    margin: 2rem auto;
    border: 4px solid #f3f3f3;
    border-top: 4px solid var(--accent);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
