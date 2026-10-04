# .

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## インターネット越しの接続

このゲームは PeerJS/WebRTC を使うため、別ネットワーク間では STUN だけで接続できない場合があります。開発サーバーは Cloudflare TURN の短期資格情報をサーバー側で生成し、ブラウザへ渡します。API トークンは絶対に `VITE_` 変数へ設定しないでください。

```sh
export CLOUDFLARE_TURN_TOKEN_ID=your-turn-token-id
export CLOUDFLARE_TURN_API_TOKEN=your-cloudflare-api-token
npm run dev
```

Vercel では [api/turn-ice-servers.js](api/turn-ice-servers.js) が `/api/turn-ice-servers` として自動的にサーバーレス関数になります。Vercel の Project Settings > Environment Variables に次の値を設定し、再デプロイしてください。

```text
CLOUDFLARE_TURN_TOKEN_ID
CLOUDFLARE_TURN_API_TOKEN
```

これらは `VITE_` を付けず、ブラウザへ公開しないでください。複数の ICE サーバーを直接指定する場合は `VITE_ICE_SERVERS` に PeerJS 形式の JSON 配列を設定できます。

## 使ったプロンプト

````md
あなたはプロのゲームプログラマーです.

## 命令

以下の要件を満たす型安全な JavaScirpt の "Game" Class を生成してください.
型は JSDoc または \*.d.ts で宣言してください.

## 基本ゲームルール

### 手持ち合計が21に近い方が勝利

交互に数字が書かれたカードを山札から引き、手持ちカードの合計がより21に近い方が勝つ。
手持ち合計値21を超えるとバーストとなり、相手もバーストしていなければ負けとなる。

### 同じ数字の場合は引き分け（ドロー）

お互いが同じ数字の場合は、引き分け。
なお、お互いがバーストしている場合は、より21に近い方が勝利。

### 山札について

1から11の数字が書かれたカードが1セット11枚しかないため、場に出ているカードと同じカードを引けない。

### SPカードについて

SPカードとは、自分の手札を有利にしたり相手を不利な立場に陥れたりするオリジナルカード。
自分のターンに使用できる。
使うと消費されてしまうタイプのカードの場合は何枚でも使用でき、場に置くタイプのカードは5枚まで置ける。

## ゲームの進め方

1. 互いに２枚のカードが山札から配られる。このとき片方のカードは互いに見ることができるが、もう片方のカードは自分しか見ることができない
2. 先攻を決め、順番に山札からカードを1枚引くか、パスするかを選ぶ。両者が4回づつ、合計8回のターンを終えたら、そのラウンドは終了で、勝敗のジャッジに移る
3. 最初は両者とも5機を持っており、1ラウンドの敗者は1機マイナスされる。ラウンドと同じ数の分だけ賭ける機の数は増えていく。例えば、2ラウンドの敗者は2機、3ラウンドの敗者は3機を賭ける必要がある。
4. どちらかが先に5機なくなったらゲーム終了

## SPカード一覧

- ドロー「1～11」: 山札に残っている場合のみ、「1～11」のカードを引く。
- リムーブ: 相手が最後に引いた表向きのカードを山札に戻す。
- デストロイ: 相手が最後に場に置いたSPカードを取り除く。
- デストロイ+: 相手が場に置いたSPカードをすべて取り除く。
- パーフェクトドロー: 山札の中から、一番良い数字のカードを引く。
- パーフェクトドロー+: 山札の中から、一番良い数字のカードを引く。さらに場に置かれている間、相手の賭け数を5つ増やす。
- アルティメットドロー: 山札の中から、一番良い数字のカードを引く。さらにSPカードを2枚引く。
- ベットアップ1: SPカードを1枚引く。さらに場に置かれている間、相手の賭け数を1つ増やす。
- ベットアップ2: SPカードを1枚引く。さらに場に置かれている間、相手の賭け数を2つ増やす。
- ベットアップ2+: 相手が最後に引いた表向きのカードを山札に戻す。さらに場に置かれている間、相手の賭け数を2つ増やす。
- シールド: 場に置かれている間、自分の賭け数を1つ減らす。
- シールド+: 場に置かれている間、自分の賭け数を2つ減らす。
- SPチェンジ: 自分のSPカードをランダムで2枚捨てる。さらにSPカードを3枚引く。
- SPチェンジ+: 自分のSPカードをランダムで1枚捨てる。さらにSPカードを4枚引く。

```specials.js
export const specials = [
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
```
````

```

```
