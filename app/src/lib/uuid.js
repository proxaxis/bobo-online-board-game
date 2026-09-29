const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * UUIDv4 文字列を Base58 エンコードする
 * @param {string} uuid - 例: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 * @returns {string} Base58 文字列（最大22文字）
 */
function toBase58(uuid) {
  // ハイフンを除去して16進数文字列にする
  const hex = uuid.replace(/-/g, '');

  // 先頭の 0x00 バイト数をカウント（Base58 の仕様で '1' に変換するため）
  let leadingZeroBytes = 0;
  for (let i = 0; i < hex.length; i += 2) {
    if (hex.slice(i, i + 2) === '00') {
      leadingZeroBytes++;
    } else {
      break;
    }
  }

  // 16進数を BigInt に変換
  let num = BigInt('0x' + hex);
  let encoded = '';
  const base = 58n;

  // 58で割った余りを下位桁から順に変換
  while (num > 0n) {
    const remainder = Number(num % base);
    num = num / base;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  // 先頭の 0x00 バイト分 '1' を追加
  return '1'.repeat(leadingZeroBytes) + (encoded || '1');
}

/**
 * Base58 文字列を元の UUIDv4 形式に復元する
 * @param {string} b58 - Base58 エンコード文字列
 * @returns {string} ハイフン付き UUID 文字列
 */
function toUuid(b58) {
  const base = 58n;
  let num = 0n;

  for (const char of b58) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base58 character: ${char}`);
    num = num * base + BigInt(index);
  }

  // 32桁の16進数文字列（ゼロパディング）に変換
  let hex = num.toString(16).padStart(32, '0');

  // ハイフンを入れて UUID 形式を復元
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

/**
 * Base58 エンコードした UUID を生成
 * @param {string} [prefix=''] 必要に応じてプレフィックスを付ける
 * @returns {string} 例: "7sxmQLdXMtaqNRZTk9JwNt7v7VowXii1irBLhH5AwNbJ"
 */
function generateId(prefix = '') {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant
  return prefix + toBase58(
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('-')
  );
}

export {
  toBase58,
  toUuid,
  generateId,
};
