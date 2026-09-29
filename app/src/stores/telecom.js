import { defineStore } from 'pinia';
import { ref, shallowRef, computed, onScopeDispose } from 'vue';
import { TelecomClient } from '@/lib/telecom-client.js';

/**
 * @typedef {import('@/lib/telecom-client.d.ts').PeerJsOptions} PeerJsOptions
 * @typedef {import('@/lib/telecom-client.d.ts').PeerJsDataConnection} PeerJsDataConnection
 * @typedef {import('@/lib/telecom-client.d.ts').PeerJsConnectOption} PeerJsConnectOption
 * @typedef {import('@/lib/telecom-client.d.ts').ExchangeMessage} ExchangeMessage
 * @typedef {import('@/lib/telecom-client.d.ts').MessageSubscribeHandler} MessageSubscribeHandler
 * @typedef {import('@/lib/telecom-client.d.ts').MessageUnsubscribeHandler} MessageUnsubscribeHandler
 * @typedef {import('@/lib/telecom-client.d.ts').TelecomEventMap} TelecomEventMap
 */

export const useTelecomStore = defineStore('telecom', () => {
  /** @type {import('vue').ShallowRef<TelecomClient | null>} */
  const client = shallowRef(null);

  /** @type {import('vue').Ref<string>} */
  const myClientId = ref('');

  /** @type {import('vue').Ref<boolean>} */
  const isReady = ref(false);

  /** @type {import('vue').Ref<boolean>} */
  const isInitializing = ref(false);

  /** @type {import('vue').Ref<string[]>} */
  const connections = ref([]);

  /** @type {import('vue').Ref<Error | null>} */
  const error = ref(null);

  const hasConnections = computed(() => connections.value.length > 0);
  const connectionCount = computed(() => connections.value.length);

  /**
   * シグナリングサーバとの接続の初期化（多重実行時は既存接続を再利用）
   * @param {PeerJsOptions} [options={}]
   * @returns {Promise<string>} サーバから割り当てられた Client ID
   */
  const init = async (options = {}) => {
    // 既に接続済みならその ID を即返却
    if (client.value && isReady.value && myClientId.value) return myClientId.value;

    if (isInitializing.value) {
      // 初期化中の重複呼び出しを待機
      return new Promise((resolve, reject) => {
        client.value?.addEventListener('SIG_READY', (e) => resolve(e.detail.id), { once: true });
        client.value?.addEventListener('SIG_ERROR', (e) => reject(e.detail.error), { once: true });
      });
    }

    isInitializing.value = true;
    error.value = null;

    try {
      const instance = new TelecomClient(options);

      // 内部イベントリスナーの登録と状態の同期
      instance.addEventListener('SIG_READY', (e) => {
        myClientId.value = e.detail.id;
        isReady.value = true;
        isInitializing.value = false;
      });

      instance.addEventListener('CON_CONNECTED', () => {
        connections.value = instance.getConnectedIds();
      });

      instance.addEventListener('CON_DISCONNECTED', () => {
        connections.value = instance.getConnectedIds();
      });

      instance.addEventListener('SIG_ERROR', (e) => {
        error.value = e.detail.error;
        isInitializing.value = false;
      });

      instance.addEventListener('SIG_CLOSE', () => {
        myClientId.value = '';
        isReady.value = false;
        connections.value = [];
      });

      client.value = instance;

      const id = await instance.init();
      return id;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      isInitializing.value = false;
      throw err;
    }
  };

  /**
   * 相手への接続
   * @param {string} destClientId - 接続先 Client ID
   * @param {PeerJsConnectOption} [options] - 接続オプション
   * @returns {Promise<PeerJsDataConnection>} - 接続が確立した PeerJsDataConnection オブジェクト
   */
  const connect = async (destClientId, options) => {
    if (!client.value) throw new Error('Peer store is not initialized yet.');
    return await client.value.connect(destClientId, options);
  };

  /**
   * 特定の相手にメッセージ送信
   * @param {string} destClientId - 送信先 Client ID
   * @param {string} type - メッセージ識別子
   * @param {*} payload - 送信するデータ
   */
  const to = (destClientId, type, payload) => {
    if (!client.value) return false;
    return client.value.to(destClientId, type, payload);
  };

  /**
   * 全接続先へのブロードキャスト送信
   * @param {string} type
   * @param {*} payload
   * @param {string[]} [excludeClientIds=[]]
   */
  const broadcast = (type, payload, excludeClientIds = []) => {
    if (!client.value) return;
    client.value.broadcast(type, payload, excludeClientIds);
  };

  /**
   * 特定の Client との切断
   * @param {string} destClientId - 切断対象の Client ID
   */
  const disconnectPeer = (destClientId) => {
    if (!client.value) return;
    client.value.disconnectPeer(destClientId);
  };

  /**
   * メッセージリスナーの登録（コンポーネント側で呼び出された場合、コンポーネントのアンマウント時に自動でリスナー解除）
   * @param {string} type - メッセージ識別子
   * @param {MessageSubscribeHandler} handler - メッセージ受信時のコールバック関数
   * @returns {MessageUnsubscribeHandler} 手動解除用関数
   */
  const onMessage = (type, handler) => {
    if (!client.value) throw new Error('Peer store must be initialized before registering handlers.');

    const unsubscribe = client.value.onMessage(type, handler);

    // 呼び出し元のエフェクトスコープ（コンポーネント等）が破棄されたら自動クリーンアップ
    try {
      onScopeDispose(() => unsubscribe());
    } catch {
      // ストア直下など scopeDispose 外で呼ばれた場合は無視
    }

    return unsubscribe;
  };

  /**
   * アプリ終了・ログアウト時など、完全に Peer 接続を落とす
   */
  const destroy = () => {
    if (client.value) {
      client.value.destroy();
      client.value = null;
    }
    myClientId.value = '';
    isReady.value = false;
    isInitializing.value = false;
    connections.value = [];
  };

  return {
    // 状態
    myClientId,
    isReady,
    isInitializing,
    connections,
    error,
    hasConnections,
    connectionCount,

    // 操作
    init,
    connect,
    to,
    broadcast,
    disconnectPeer,
    onMessage,
    destroy,
  };
});
