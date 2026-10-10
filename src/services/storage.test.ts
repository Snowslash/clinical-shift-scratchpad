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
  const exports: { encryptedStorageDriver?: StorageDriver } = {};
  const native = {
    async getItemAsync(key: string) { return values.get(key) ?? null; },
    async setItemAsync(key: string, value: string) {
      if (++writes === failWrite) throw new Error('write failed');
      expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(1800);
      expect(value.isWellFormed()).toBe(true);
      values.set(key, value);
    },
    async deleteItemAsync(key: string) {
      if (failDelete) throw new Error('delete failed');
      values.delete(key);
    },
  };
  const source = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: () => native });
  return { driver: exports.encryptedStorageDriver!, values,
    failAt: (n: number) => { writes = 0; failWrite = n; },
    failDeletion: () => { failDelete = true; } };
};

const key = 'test/jobs';
const oldValue = 'old'.repeat(1500);
const newValue = 'new'.repeat(1700);

describe('secure storage persistence', () => {
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
