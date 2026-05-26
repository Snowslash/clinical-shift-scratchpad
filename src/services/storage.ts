declare const require: (name: string) => any;

/**
 * Replaceable local storage abstraction.
 *
 * Default driver uses Expo SecureStore on native platforms. SecureStore stores
 * values in iOS Keychain / Android encrypted SharedPreferences. Because
 * SecureStore has practical per-value size limits, larger values are split
 * into small encrypted chunks behind a manifest.
 *
 * This remains local-only temporary storage. It is a better first-pass privacy
 * posture than AsyncStorage, but it is not a GDPR/NHS/clinical-safety claim.
 */
export interface StorageDriver {
  encryptedAtRest?: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const STORAGE_DRIVER_KIND = 'secure-store' as const;

const CHUNK_SIZE = 1800;
const MANIFEST_PREFIX = 'secure-chunks:v1:';

interface SecureChunkManifest {
  type: typeof MANIFEST_PREFIX;
  chunks: number;
}

const hashKey = (key: string): string => {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 33) ^ key.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

/**
 * Expo SecureStore rejects keys containing characters such as `/` and `:` on
 * some SDK/platform combinations. App-level keys remain descriptive; this
 * function maps them to stable non-empty alphanumeric SecureStore keys.
 */
export const getSecureStoreKey = (key: string): string => `Css${hashKey(key)}${key.length.toString(36)}`;

export const getSecureStoreChunkKey = (key: string, index: number): string =>
  `CssChunk${hashKey(`${key}:${index}`)}${index.toString(36)}`;

const getSecureStore = () => require('expo-secure-store') as {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const parseManifest = (raw: string | null): SecureChunkManifest | null => {
  if (!raw?.startsWith(MANIFEST_PREFIX)) return null;
  try {
    const manifest = JSON.parse(raw.slice(MANIFEST_PREFIX.length)) as Partial<SecureChunkManifest>;
    return typeof manifest.chunks === 'number' && manifest.chunks >= 0
      ? { type: MANIFEST_PREFIX, chunks: manifest.chunks }
      : null;
  } catch {
    return null;
  }
};

const removeChunkedValue = async (appKey: string, previousRaw: string | null): Promise<void> => {
  const SecureStore = getSecureStore();
  const manifest = parseManifest(previousRaw);
  if (!manifest) return;

  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) => SecureStore.deleteItemAsync(getSecureStoreChunkKey(appKey, index))),
  );
};

export const encryptedStorageDriver: StorageDriver = {
  encryptedAtRest: true,

  async getItem(key: string): Promise<string | null> {
    const SecureStore = getSecureStore();
    const secureKey = getSecureStoreKey(key);
    const raw = await SecureStore.getItemAsync(secureKey);
    const manifest = parseManifest(raw);
    if (!manifest) return raw;

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunks }, (_, index) => SecureStore.getItemAsync(getSecureStoreChunkKey(key, index))),
    );

    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const SecureStore = getSecureStore();
    const secureKey = getSecureStoreKey(key);
    const previousRaw = await SecureStore.getItemAsync(secureKey);
    await removeChunkedValue(key, previousRaw);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(secureKey, value);
      return;
    }

    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g')) ?? [];
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(getSecureStoreChunkKey(key, index), chunk)));
    await SecureStore.setItemAsync(secureKey, `${MANIFEST_PREFIX}${JSON.stringify({ chunks: chunks.length })}`);
  },

  async removeItem(key: string): Promise<void> {
    const SecureStore = getSecureStore();
    const secureKey = getSecureStoreKey(key);
    const previousRaw = await SecureStore.getItemAsync(secureKey);
    await removeChunkedValue(key, previousRaw);
    await SecureStore.deleteItemAsync(secureKey);
  },
};
