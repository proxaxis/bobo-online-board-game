import { ref } from 'vue';
import { defineStore } from 'pinia';
import Peer from 'peerjs';

export const useConnectionStore = defineStore('connection', () => {
  const id = ref(null);
  const destId = ref(null);
  const isPeerEstablished = ref(false);
  const isConnectionOpen = ref(false);

  let rwPeer = null;
  let rwConnection = null;
  const rwReceiveHandlers = new Set();
  const rwPendingMessages = [];

  function clearTransport() {
    if (rwConnection) {
      rwConnection.close();
      rwConnection = null;
    }
    if (rwPeer) {
      rwPeer.destroy();
      rwPeer = null;
    }
    isPeerEstablished.value = false;
    isConnectionOpen.value = false;
  }

  function flushPendingMessages(handler) {
    if (!rwPendingMessages.length) return;

    const arr = rwPendingMessages.splice(0, rwPendingMessages.length);
    arr.forEach((message) => handler(message));
  }

  function bindConnection(conn, callbacks = {}) {
    rwConnection = conn;
    destId.value = conn.peer;

    conn.on('open', () => {
      isConnectionOpen.value = true;
      if (typeof callbacks.open === 'function') callbacks.open();
      if (typeof callbacks.connection === 'function') callbacks.connection(conn);
      if (rwReceiveHandlers.size > 0 && rwPendingMessages.length > 0) {
        rwReceiveHandlers.forEach((handler) => flushPendingMessages(handler));
      }
    });

    conn.on('data', (data) => {
      if (rwReceiveHandlers.size === 0) {
        rwPendingMessages.push(data);
        return;
      }

      rwReceiveHandlers.forEach((handler) => {
        handler(data);
      });
    });

    conn.on('close', () => {
      isConnectionOpen.value = false;
      if (typeof callbacks.close === 'function') callbacks.close();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      isConnectionOpen.value = false;
      if (typeof callbacks.error === 'function') callbacks.error(err);
    });
  }

  function init(callback = {}) {
    // peer と connection を初期化
    clearTransport();
    rwReceiveHandlers.clear();
    rwPendingMessages.splice(0, rwPendingMessages.length);

    // 既存の Peer ID があれば使用し、なければ新しい Peer を作成
    if (id.value) {
      // メモリ上の Peer ID が存在する場合はそれを使用
      rwPeer = new Peer(id.value);
    } else if (localStorage.getItem('lastPeerInfo')) {
      // ローカルストレージに保存された Peer ID が存在する場合はそれを使用
      const info = JSON.parse(localStorage.getItem('lastPeerInfo'));
      rwPeer = new Peer(info.id);
    } else {
      // なければ新しい Peer を作成
      rwPeer = new Peer();
    }

    // Open イベント
    rwPeer.on('open', (to) => {
      const now = new Date();
      id.value = to;
      localStorage.setItem(
        'lastPeerInfo',
        JSON.stringify({
          id: to,
          created: now.toISOString(),
          used: now.toISOString(),
        }),
      );
      isPeerEstablished.value = true;
      if (typeof callback === 'function') callback?.(to);
      else if (typeof callback === 'object') callback.open?.(to);
    });

    // Connection イベント
    rwPeer.on('connection', (conn) => {
      bindConnection(conn, {
        connection: () => {
          if (typeof callback === 'object') callback.connection?.(conn);
        },
        error: callback.error,
        close: callback.close,
      });
    });

    // Close イベント
    rwPeer.on('close', () => {
      id.value = null;
      localStorage.removeItem('lastPeerInfo');
      isPeerEstablished.value = false;
      isConnectionOpen.value = false;
      if (typeof callback === 'object') callback.close?.();
    });

    // Disconnected イベント
    rwPeer.on('disconnected', () => {
      id.value = null;
      localStorage.removeItem('lastPeerInfo');
      isPeerEstablished.value = false;
      isConnectionOpen.value = false;
      if (typeof callback === 'object') callback.disconnected?.();
    });

    // Error イベント
    rwPeer.on('error', (err) => {
      console.error('Peer error:', err);
      isPeerEstablished.value = false;
      isConnectionOpen.value = false;
      if (typeof callback === 'object') callback.error?.(err);
    });
  }

  function connect(callback = {}) {
    if (!isPeerEstablished.value) throw new Error('Peer is not established');
    if (!destId.value) throw new Error('Destination ID is not set');

    const conn = rwPeer.connect(destId.value);
    bindConnection(conn, callback);
  }

  function send(payload) {
    if (!isPeerEstablished.value || !isConnectionOpen.value) throw new Error('Connection is not ready');
    rwConnection.send(payload);
  }

  function handleReceive(callback) {
    if (typeof callback !== 'function') throw new Error('Receive callback must be a function');
    rwReceiveHandlers.add(callback);
    flushPendingMessages(callback);
    return () => {
      rwReceiveHandlers.delete(callback);
    };
  }

  function close() {
    clearTransport();
    rwReceiveHandlers.clear();
    rwPendingMessages.splice(0, rwPendingMessages.length);
  }

  return { id, destId, isPeerEstablished, isConnectionOpen, init, connect, send, handleReceive, close };
});
