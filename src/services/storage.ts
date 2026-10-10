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
  generation: string;
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

export const getSecureStoreChunkKey = (key: string, index: number, generation = ''): string =>
  `${getSecureStoreKey(key)}Chunk${generation}N${index.toString(36)}`;

const getSecureStore = () => require('expo-secure-store') as {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const parseManifest = (raw: string | null): SecureChunkManifest | null => {
  if (!raw?.startsWith(MANIFEST_PREFIX)) return null;
  const manifest = JSON.parse(raw.slice(MANIFEST_PREFIX.length)) as Partial<SecureChunkManifest> | null;
  if (!manifest || !Number.isSafeInteger(manifest.chunks) || manifest.chunks! < 1
    || typeof manifest.generation !== 'string' || !/^[a-z0-9]+$/.test(manifest.generation)) {
    throw new Error('Invalid secure storage manifest');
  }
  return manifest as SecureChunkManifest;
};

const removeChunkedValue = async (appKey: string, previousRaw: string | null): Promise<void> => {
  const SecureStore = getSecureStore();
  const manifest = parseManifest(previousRaw);
  if (!manifest) return;

  await Promise.all(
    Array.from({ length: manifest.chunks }, (_, index) => SecureStore.deleteItemAsync(getSecureStoreChunkKey(appKey, index, manifest.generation))),
  );
};

// Serialize reads too: a reader must finish before its generation is cleaned up.
let pending: Promise<unknown> = Promise.resolve();
const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
};
let generationCounter = 0;

export const encryptedStorageDriver: StorageDriver = {
  encryptedAtRest: true,

  getItem(key: string): Promise<string | null> {
    return serialize(async () => {
      const SecureStore = getSecureStore();
      const secureKey = getSecureStoreKey(key);
      const raw = await SecureStore.getItemAsync(secureKey);
      const manifest = parseManifest(raw);
      if (!manifest) return raw;

      const chunks = await Promise.all(
        Array.from({ length: manifest.chunks }, (_, index) => SecureStore.getItemAsync(getSecureStoreChunkKey(key, index, manifest.generation))),
      );

      if (chunks.some((chunk) => chunk === null)) throw new Error('Missing secure storage chunk');
      return chunks.join('');
    });
  },

  setItem(key: string, value: string): Promise<void> {
    return serialize(async () => {
      const SecureStore = getSecureStore();
      const secureKey = getSecureStoreKey(key);
      const previousRaw = await SecureStore.getItemAsync(secureKey);
      const generation = `${Date.now().toString(36)}${(++generationCounter).toString(36)}${Math.random().toString(36).slice(2)}`;
      // Count UTF-8 bytes, preserving separators and surrogate pairs.
      const chunks: string[] = [];
      let chunk = '';
      let bytes = 0;
      for (const character of value) {
        const point = character.codePointAt(0)!;
        const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
        if (bytes + size > CHUNK_SIZE) {
          chunks.push(chunk);
          chunk = '';
          bytes = 0;
        }
        chunk += character;
        bytes += size;
      }
      chunks.push(chunk);
      const writtenKeys: string[] = [];
      try {
        if (chunks.length === 1 && !value.startsWith(MANIFEST_PREFIX)) {
          await SecureStore.setItemAsync(secureKey, value);
        } else {
          for (const [index, part] of chunks.entries()) {
            const chunkKey = getSecureStoreChunkKey(key, index, generation);
            writtenKeys.push(chunkKey);
            await SecureStore.setItemAsync(chunkKey, part);
          }
          await SecureStore.setItemAsync(secureKey, `${MANIFEST_PREFIX}${JSON.stringify({ chunks: chunks.length, generation })}`);
        }
      } catch (error) {
        // Best effort rollback; never mask the original save failure.
        await Promise.allSettled(writtenKeys.map((chunkKey) => SecureStore.deleteItemAsync(chunkKey)));
        throw error;
      }
      // The new value is committed. Cleanup errors still reach the caller.
      await removeChunkedValue(key, previousRaw);
    });
  },

  removeItem(key: string): Promise<void> {
    return serialize(async () => {
      const SecureStore = getSecureStore();
      const secureKey = getSecureStoreKey(key);
      const previousRaw = await SecureStore.getItemAsync(secureKey);
      await SecureStore.deleteItemAsync(secureKey);
      await removeChunkedValue(key, previousRaw);
    });
  },
};
