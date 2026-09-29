import type { PeerOptions, DataConnection, PeerConnectOption } from 'peerjs';

/** クライアント間で共有するメッセージのフォーマット */
export interface ExchangeMessage {
  type: string;
  payload: any;
  id?: string;
  timestamp?: number;
}

/** メッセージ購読コールバック関数 */
export type MessageSubscribeHandler = (
  payload: any,
  srcClientId: string,
  message: ExchangeMessage
) => void;

/** メッセージ購読解除関数 */
export type MessageUnsubscribeHandler = () => void;

/** TelecomClient が発行するイベント一覧 */
export interface TelecomEventMap {
  SIG_READY: CustomEvent<{ id: string }>;
  SIG_ERROR: CustomEvent<{ error: any }>;
  SIG_DISCONNECTED: CustomEvent<void>;
  SIG_CLOSE: CustomEvent<void>;
  CON_CONNECTED: CustomEvent<{ peerId: string; connection: DataConnection }>;
  CON_DISCONNECTED: CustomEvent<{ peerId: string }>;
  CON_ERROR: CustomEvent<{ peerId: string; error: any }>;
  RECEIVED_MESSAGE: CustomEvent<ExchangeMessage>;
}

/** 整形した、PeerJS が発行するイベントの型 */
export type { PeerOptions as PeerJsOptions, DataConnection as PeerJsDataConnection, PeerConnectOption as PeerJsConnectOption };
