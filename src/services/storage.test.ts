import { describe, expect, it } from 'vitest';
import { encryptedStorageDriver, getSecureStoreKey, getSecureStoreChunkKey, STORAGE_DRIVER_KIND } from './storage';

describe('encrypted storage driver', () => {
  it('uses encrypted secure storage as the default storage driver', () => {
    expect(STORAGE_DRIVER_KIND).toBe('secure-store');
    expect(encryptedStorageDriver.encryptedAtRest).toBe(true);
  });

  it('derives non-empty alphanumeric SecureStore keys from namespaced app keys', () => {
    const appKey = 'clinical-shift-scratchpad/jobs/v1';
    const secureKey = getSecureStoreKey(appKey);
    const chunkKey = getSecureStoreChunkKey(appKey, 3);

    expect(secureKey).toMatch(/^[A-Za-z0-9]+$/);
    expect(chunkKey).toMatch(/^[A-Za-z0-9]+$/);
    expect(secureKey.length).toBeGreaterThan(0);
    expect(chunkKey.length).toBeGreaterThan(0);
    expect(secureKey).not.toContain('/');
    expect(chunkKey).not.toContain(':');
  });
});
