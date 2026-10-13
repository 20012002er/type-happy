// 存档加密：使用 Web Crypto API AES-GCM
// 提供真正的加密保护，而非简单的 XOR 混淆

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// 版本前缀：V2 使用 AES-GCM
const PREFIX = 'WUXIA2:';

// 固定密钥派生（客户端存储，无需用户输入）
// 注意：这是客户端游戏，密钥硬编码在代码中
// 对于防止普通用户篡改足够，但不适用于高安全场景
const STATIC_SALT = new TextEncoder().encode('wuxia-idle-v2-salt');
const STATIC_KEY = 'wuxia-idle-v2-key';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

const toB64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const fromB64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// 派生加密密钥
let cachedKey: CryptoKey | null = null;

const getKey = async (): Promise<CryptoKey> => {
  if (cachedKey) return cachedKey;

  // 使用密码+盐派生密钥
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(STATIC_KEY),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: STATIC_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
};

export const createCipher = async (plainText: string): Promise<string> => {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = TEXT_ENCODER.encode(plainText);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  // 拼接 IV + 密文
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);

  return PREFIX + toB64(payload);
};

export const parseCipher = async (cipherText: string): Promise<string> => {
  if (!cipherText.startsWith(PREFIX)) {
    throw new Error('invalid save payload format');
  }

  const raw = cipherText.slice(PREFIX.length);
  const bytes = fromB64(raw);

  if (bytes.length < IV_LENGTH + 16) {
    throw new Error('corrupted save data');
  }

  const iv = bytes.slice(0, IV_LENGTH);
  const encrypted = bytes.slice(IV_LENGTH);

  const key = await getKey();

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    return TEXT_DECODER.decode(decrypted);
  } catch {
    throw new Error('failed to decrypt - data may be corrupted');
  }
};
