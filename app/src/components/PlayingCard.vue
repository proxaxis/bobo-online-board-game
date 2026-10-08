<script setup>
defineProps({
  /** カードの数字 */
  value: {
    type: [Number, String],
    default: null,
  },
  /** 表面を向いているか（false→true でフリップアニメーション） */
  revealed: {
    type: Boolean,
    default: true,
  },
  /** 自分だけが値を把握している裏カード（点線スタイル） */
  selfHidden: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <span class="card" :class="{ revealed, 'self-hidden': selfHidden }">
    <span class="card-inner">
      <span class="card-face card-front">{{ value }}</span>
      <span class="card-face card-back" aria-hidden="true"></span>
    </span>
  </span>
</template>

<style scoped>
.card {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 60px;
  perspective: 600px;
  transition: transform 0.2s ease;
}

.card-inner {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.3, 0.9, 0.4, 1.1);
  /* --i は親から継承される配列インデックス。ショーダウン時に1枚ずつめくれる演出用 */
  transition-delay: calc(var(--i, 0) * 120ms);
}

.card:not(.revealed) .card-inner {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #333;
  border-radius: 4px;
  font-weight: bold;
  font-size: 1.2rem;
  backface-visibility: hidden;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);
}

.card-front {
  background: #fff;
  color: #333;
}

/* 自分だけが見える裏カードは点線で示す */
.card.self-hidden .card-front {
  background: #e0e0e0;
  color: #555;
  border-style: dashed;
}

.card-back {
  transform: rotateY(180deg);
  border: 3px solid #fff;
  background:
    repeating-linear-gradient(
      45deg,
      #3a6ea5 0px,
      #3a6ea5 5px,
      #2c537e 5px,
      #2c537e 10px
    );
  box-sizing: border-box;
}
</style>
