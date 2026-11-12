/// <reference types="node" />
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { StorageDriver } from './storage';
import { encryptedStorageDriver, getSecureStoreKey, getSecureStoreChunkKey, STORAGE_DRIVER_KIND } from './storage';

// Exercise the real driver with only the native SecureStore boundary replaced.
const setup = () => {
  const values = new Map<string, string>();
  let failWrite = 0;
  let writes = 0;
  let failDelete = false;
  let failAfterWrite = false;
  let failRead = false;
  let failChunkDelete = false;
  let failAfterRootDelete = false;
  const exports: { encryptedStorageDriver?: StorageDriver } = {};
  const native = {
    async getItemAsync(key: string) {
      if (failRead) throw new Error('read failed');
      return values.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      const fail = ++writes === failWrite;
      if (fail && !failAfterWrite) throw new Error('write failed');
      expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(1800);
      expect(value.isWellFormed()).toBe(true);
      values.set(key, value);
      if (fail) throw new Error('write failed after commit');
    },
    async deleteItemAsync(key: string) {
      if (failDelete) throw new Error('delete failed');
      if (failChunkDelete && key.includes('Chunk')) throw new Error('chunk cleanup failed');
      values.delete(key);
      if (failAfterRootDelete && !key.includes('Chunk')) throw new Error('delete acknowledgement failed');
    },
  };
  const source = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: () => native });
  return { driver: exports.encryptedStorageDriver!, values,
    failAt: (n: number, after = false) => { writes = 0; failWrite = n; failAfterWrite = after; },
    failReads: (value: boolean) => { failRead = value; },
    failDeletion: () => { failDelete = true; },
    failChunkDeletion: () => { failChunkDelete = true; },
    failRootDeleteAcknowledgement: () => { failAfterRootDelete = true; } };
};

const key = 'test/jobs';
const oldValue = 'old'.repeat(1500);
const newValue = 'new'.repeat(1700);

describe('secure storage persistence', () => {
  it('reports uncertain root deletion without deleting referenced chunks', async () => {
    const { driver, failDeletion } = setup();
    await driver.setItem(key, oldValue);
    failDeletion();
    await expect(driver.removeItem(key)).rejects.toMatchObject({ outcome: 'unknown' });
    expect(await driver.getItem(key)).toBe(oldValue);
  });

  it('reads the deleted state when the native delete commits then rejects', async () => {
    const { driver, failRootDeleteAcknowledgement } = setup();
    await driver.setItem(key, oldValue);
    failRootDeleteAcknowledgement();
    await expect(driver.removeItem(key)).rejects.toMatchObject({ outcome: 'unknown' });
    expect(await driver.getItem(key)).toBeNull();
    await driver.setItem(key, 'next');
    expect(await driver.getItem(key)).toBe('next');
  });

  it('reports a committed deletion when chunk cleanup fails', async () => {
    const { driver, failChunkDeletion } = setup();
    await driver.setItem(key, oldValue);
    failChunkDeletion();
    await expect(driver.removeItem(key)).rejects.toMatchObject({ outcome: 'committed' });
    expect(await driver.getItem(key)).toBeNull();
  });

  it('marks chunk staging failures as not committed', async () => {
    const { driver, failAt } = setup();
    await driver.setItem(key, oldValue);
    failAt(2);
    await expect(driver.setItem(key, newValue)).rejects.toMatchObject({ outcome: 'not-committed' });
    expect(await driver.getItem(key)).toBe(oldValue);
  });

  it('keeps the referenced generation when a manifest write commits then rejects', async () => {
    const { driver, failAt } = setup();
    await driver.setItem(key, oldValue);
    failAt(4, true);
    const [failure] = await Promise.allSettled([driver.setItem(key, newValue)]);
    expect(await driver.getItem(key)).toBe(newValue);
    expect(failure.status).toBe('rejected');
    if (failure.status === 'rejected') expect(failure.reason.outcome).toBe('unknown');
    failAt(0);
    await driver.setItem(key, 'next');
    expect(await driver.getItem(key)).toBe('next');
  });

  it.each([false, true])('treats root write rejection as uncertain (after commit: %s)', async (after) => {
    const { driver, failAt } = setup();
    await driver.setItem(key, oldValue);
    failAt(1, after);
    await expect(driver.setItem(key, 'short')).rejects.toMatchObject({ outcome: 'unknown' });
    expect(await driver.getItem(key)).toBe(after ? 'short' : oldValue);
  });

  it('marks an initial read failure as not committed', async () => {
    const { driver, failReads } = setup();
    failReads(true);
    await expect(driver.setItem(key, 'short')).rejects.toMatchObject({ outcome: 'not-committed' });
    await expect(driver.removeItem(key)).rejects.toMatchObject({ outcome: 'not-committed' });
    failReads(false);
    expect(await driver.getItem(key)).toBeNull();
  });

  it('marks replacement cleanup failure as committed', async () => {
    const { driver, failDeletion } = setup();
    await driver.setItem(key, oldValue);
    failDeletion();
    await expect(driver.setItem(key, newValue)).rejects.toMatchObject({ outcome: 'committed' });
    expect(await driver.getItem(key)).toBe(newValue);
  });

  it.each([1, 2, 3, 4])('preserves the previous value when replacement write %i fails', async (n) => {
    const { driver, failAt } = setup();
    await driver.setItem(key, oldValue);
    failAt(n);
    await expect(driver.setItem(key, newValue)).rejects.toThrow('write failed');
    expect(await driver.getItem(key)).toBe(oldValue);
    failAt(0);
    await driver.setItem(key, newValue);
    expect(await driver.getItem(key)).toBe(newValue);
  });

  it('preserves a chunked value when a short replacement fails', async () => {
    const { driver, failAt } = setup();
    await driver.setItem(key, oldValue);
    failAt(1);
    await expect(driver.setItem(key, 'short')).rejects.toThrow('write failed');
    expect(await driver.getItem(key)).toBe(oldValue);
  });

  it('roundtrips Unicode separators, newlines and astral characters', async () => {
    const { driver } = setup();
    const value = 'x'.repeat(1799) + '😀\u2028\u2029\n\r' + '界'.repeat(1900);
    await driver.setItem(key, value);
    expect(await driver.getItem(key)).toBe(value);
  });

  it('serializes overlapping saves and reads without mixed generations', async () => {
    const { driver, values } = setup();
    await driver.setItem(key, oldValue);
    const first = driver.setItem(key, newValue);
    const read = driver.getItem(key);
    const second = driver.setItem(key, 'last'.repeat(600));
    await first;
    expect(await read).toBe(newValue);
    await second;
    expect(await driver.getItem(key)).toBe('last'.repeat(600));
    await driver.removeItem(key);
    expect(values.size).toBe(0);
  });

  it('reports missing chunks instead of an absent value', async () => {
    const { driver, values } = setup();
    await driver.setItem(key, oldValue);
    values.delete([...values.keys()].find((storedKey) => storedKey !== getSecureStoreKey(key))!);
    await expect(driver.getItem(key)).rejects.toThrow();
  });

  it('reports cleanup failure while retaining the committed replacement', async () => {
    const { driver, failDeletion } = setup();
    await driver.setItem(key, oldValue);
    failDeletion();
    await expect(driver.setItem(key, newValue)).rejects.toThrow('delete failed');
    expect(await driver.getItem(key)).toBe(newValue);
  });
});

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
