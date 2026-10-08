import Peer from 'peerjs';
import { generateId } from '@/lib/uuid.js';

const defaultIceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }];

async function getIceServers() {
  const configuredServers = import.meta.env.VITE_ICE_SERVERS;
  if (configuredServers) {
    try {
      const parsedServers = JSON.parse(configuredServers);
      if (Array.isArray(parsedServers) && parsedServers.length > 0) return parsedServers;
    } catch (error) {
      console.warn('VITE_ICE_SERVERS must be valid JSON:', error);
    }
  }

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    return [...defaultIceServers, { urls: turnUrl, username: turnUsername, credential: turnCredential }];
  }

  try {
    const response = await fetch('/api/turn-ice-servers');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) return data.iceServers;
    }
  } catch (error) {
    console.warn('Unable to load Cloudflare TURN credentials:', error);
  }

  return defaultIceServers;
}

/**
 * @typedef {import('@/lib/TelecomClient.d.ts').PeerJsOptions} PeerJsOptions
 * @typedef {import('@/lib/TelecomClient.d.ts').PeerJsDataConnection} PeerJsDataConnection
 * @typedef {import('@/lib/TelecomClient.d.ts').PeerJsConnectOption} PeerJsConnectOption
 * @typedef {import('@/lib/TelecomClient.d.ts').ExchangeMessage} ExchangeMessage
 * @typedef {import('@/lib/TelecomClient.d.ts').MessageSubscribeHandler} MessageSubscribeHandler
 * @typedef {import('@/lib/TelecomClient.d.ts').MessageUnsubscribeHandler} MessageUnsubscribeHandler
 * @typedef {import('@/lib/TelecomClient.d.ts').TelecomEventMap} TelecomEventMap
 */

/**
 * PeerJS をラップして汎用データ通信を容易にするクライアントクラス。
 * 複数のピア管理、メッセージルーティング、ライフサイクル管理を提供します。
 *
 * @extends {EventTarget}
 */
export class TelecomClient extends EventTarget {
  /** @param {PeerJsOptions & { id?: string }} [params={}] - PeerJS に渡すオプション群と、自身に指定する任意の Peer ID（省略時はBase58形式で自動生成）*/
  constructor({ id: customPeerId, ...options } = {}) {
    super();

    /**
     * 自身の Peer ID（任意に指定されたか、自動生成されたもの）
     * @type {string|null|undefined}
     */
    this.id = customPeerId;

    /**
     * 任意に指定された PeerJS オプション
     * @type {PeerJsOptions}
     */
    this.myPeerOptions = { ...options };

    /**
     * 自身の PeerJS インスタンス
     * @type {Peer|null}
     */
    this.myPeerInstance = null;

    /**
     * 接続中のピア一覧
     * @type {Map<string, PeerJsDataConnection>}
     */
    this.myConnections = new Map();

    /**
     * メッセージタイプごとのハンドラ
     * @type {Map<string, Set<MessageSubscribeHandler>>}
     */
    this.myMessageHandlers = new Map();
  }

  /**
   * 型安全なイベントリスナーの登録
   * @template {keyof TelecomEventMap} K
   * @param {K | string} type - イベント名
   * @param {((event: K extends keyof TelecomEventMap ? TelecomEventMap[K] : Event) => void) | EventListenerObject | null} listener - コールバック関数またはリスナーオブジェクト
   * @param {boolean | AddEventListenerOptions} [options]
   */
  addEventListener(type, listener, options) {
    super.addEventListener(type, /** @type {EventListener} */ (listener), options);
  }

  /**
   * 型安全なイベントリスナーの解除
   * @template {keyof TelecomEventMap} K
   * @param {K | string} type - イベント名
   * @param {((event: K extends keyof TelecomEventMap ? TelecomEventMap[K] : Event) => void) | EventListenerObject | null} listener - コールバック関数またはリスナーオブジェクト
   * @param {boolean | EventListenerOptions} [options]
   */
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, /** @type {EventListener} */ (listener), options);
  }

  /**
   * イベントバインドなどを含めて、シグナリングサーバーへの接続を初期化し、自身の ID 取得を待機
   * @returns {Promise<string>} 割り当てられた自身の Peer ID
   */
  async init() {
    const peerOptions = {
      ...this.myPeerOptions,
      config: this.myPeerOptions.config ?? { iceServers: await getIceServers() },
    };

    return new Promise((resolve, reject) => {
      this.myPeerInstance = new Peer(this.id || generateId(), peerOptions);

      this.myPeerInstance.on('open', (id) => {
        this.id = id;
        this.dispatchEvent(new CustomEvent('SIG_READY', { detail: { id } }));
        resolve(id);
      });

      this.myPeerInstance.on('connection', (/** @type {PeerJsDataConnection} */ conn) => {
        setupConnection(this, conn);
      });

      this.myPeerInstance.on('disconnected', () => {
        this.dispatchEvent(new CustomEvent('SIG_DISCONNECTED'));
      });

      this.myPeerInstance.on('close', () => {
        this.myConnections.clear();
        this.dispatchEvent(new CustomEvent('SIG_CLOSE'));
      });

      this.myPeerInstance.on('error', (err) => {
        this.dispatchEvent(new CustomEvent('SIG_ERROR', { detail: { error: err } }));
        if (!this.id) reject(err); // open 前のエラー時は Promise を reject
      });
    });
  }

  /**
   * イベントバインドなどを含めて、指定した相手の Peer ID へ接続を開始
   * @param {string} destPeerId - 接続先 Peer ID
   * @param {PeerJsConnectOption} [options={}] - 接続のオプション群
   * @returns {Promise<PeerJsDataConnection>} - 接続が確立した PeerJsDataConnection オブジェクト
   */
  connect(destPeerId, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.myPeerInstance || this.myPeerInstance.destroyed) {
        return reject(new Error('Peer is not initialized or has been destroyed.'));
      }

      if (this.myConnections.has(destPeerId)) {
        const conn = this.myConnections.get(destPeerId);
        if (!conn) return reject(new Error(`Connection to ${destPeerId} exists but is null.`));
        return resolve(conn);
      }

      const conn = this.myPeerInstance.connect(destPeerId, options);

      conn.on('open', () => {
        setupConnection(this, conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 特定のピアにメッセージを送信します。
   * @param {string} destPeerId - 送信先ピア ID
   * @param {string} type - メッセージ種別
   * @param {*} payload - 送信データ
   * @returns {boolean} 送信キューに入ったかどうか
   */
  to(destPeerId, type, payload) {
    const conn = this.myConnections.get(destPeerId);
    if (!conn || !conn.open) {
      console.warn(`Cannot send: Peer [${destPeerId}] is not connected or open.`);
      return false;
    }

    /** @type {ExchangeMessage} */
    const msg = {
      type,
      payload,
      timestamp: Date.now(),
    };

    conn.send(msg);
    return true;
  }

  /**
   * 現在接続中の全ピアにメッセージを一斉送信
   * @param {string} type - メッセージ種別
   * @param {*} payload - 送信データ
   * @param {string[]} [excludeUserIds=[]] - 送信対象から除外する Peer ID の配列
   */
  broadcast(type, payload, excludeUserIds = []) {
    const excludeSet = new Set(excludeUserIds);
    for (const [peerId, conn] of this.myConnections.entries()) {
      if (!excludeSet.has(peerId) && conn.open) {
        conn.send({
          type,
          payload,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * 特定のメッセージタイプを購読するコールバックを登録
   * @param {string} type - 購読対象のタイプ
   * @param {MessageSubscribeHandler} handler - メッセージ受信時のコールバック関数
   * @returns {MessageUnsubscribeHandler} 購読解除関数
   */
  onMessage(type, handler) {
    if (!this.myMessageHandlers.has(type)) {
      this.myMessageHandlers.set(type, new Set());
    }
    const set = this.myMessageHandlers.get(type);
    if (!set) throw new Error(`Failed to get handler set for type: ${type}`);

    set.add(handler);

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.myMessageHandlers.delete(type);
      }
    };
  }

  /**
   * 現在接続中のピアのリストを取得
   * @returns {string[]}
   */
  getConnectedIds() {
    return Array.from(this.myConnections.keys());
  }

  /**
   * 特定ピアとの接続を切断
   * @param {string} destPeerId
   */
  disconnectPeer(destPeerId) {
    const conn = this.myConnections.get(destPeerId);
    if (conn) {
      conn.close();
      this.myConnections.delete(destPeerId);
    }
  }

  /**
   * クライアントを完全に終了し、全ピア接続およびシグナリング接続を破棄
   * @returns {void}
   */
  destroy() {
    this.myMessageHandlers.clear();
    this.myConnections.clear();
    for (const conn of this.myConnections.values()) {
      conn.close();
    }
    this.myConnections.clear();

    if (this.myPeerInstance && !this.myPeerInstance.destroyed) {
      this.myPeerInstance.destroy();
    }
    this.myPeerInstance = null;
    this.id = null;
  }
}

/**
 * 確立した PeerDataConnection に対する内部イベントバインド
 * @param {TelecomClient} client
 * @param {PeerJsDataConnection} conn
 */
function setupConnection(client, conn) {
  // A. 接続確立時に、接続マップに追加し、peer-connected イベントを発火
  conn.on('open', () => {
    client.myConnections.set(conn.peer, conn);
    client.dispatchEvent(
      new CustomEvent('CON_CONNECTED', {
        detail: { peerId: conn.peer, connection: conn },
      }),
    );
  });

  // B. データ受信時に、データをパースし、対応するハンドラおよびイベントへ振り分け
  conn.on('data', (/** @type {*} */ data) => {
    const srcPeerId = conn.peer;

    /** @type {ExchangeMessage} */
    let message;

    if (data && typeof data === 'object' && 'type' in data) {
      message = {
        ...data,
        id: srcPeerId,
        timestamp: data.timestamp || Date.now(),
      };
    }
    // 受信データが ExchangeMessage 形式でない場合は警告を出す
    else {
      return console.warn(`Received invalid message from [${srcPeerId}]:`, data);
    }

    // 全体受信イベントの発火
    client.dispatchEvent(
      new CustomEvent('RECEIVED_MESSAGE', {
        detail: message,
      }),
    );

    // 特定 type に対するハンドラの実行
    const handlers = client.myMessageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((/** @type {MessageSubscribeHandler} */ fn) => {
        try {
          fn(message.payload, srcPeerId, message);
        } catch (e) {
          console.error(`Error in message handler for type [${message.type}]:`, e);
        }
      });
    }
  });

  // C. 接続終了時に、接続マップから削除し、peer-disconnected イベントを発火
  conn.on('close', () => {
    client.myConnections.delete(conn.peer);
    client.dispatchEvent(
      new CustomEvent('CON_DISCONNECTED', {
        detail: { peerId: conn.peer },
      }),
    );
  });

  // D. 接続エラー時に、connection-error イベントを発火
  conn.on('error', (err) => {
    client.dispatchEvent(
      new CustomEvent('CON_ERROR', {
        detail: { peerId: conn.peer, error: err },
      }),
    );
  });

  // Z. すでに open 済みの状態で渡された場合のフォールバック
  if (conn.open && !client.myConnections.has(conn.peer)) {
    client.myConnections.set(conn.peer, conn);
  }
}
