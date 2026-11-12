/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClinicalJob } from '../src/types/job';

// Real JobStore, encrypted driver and recovery hook. Only native SecureStore
// calls are substituted; this mounted controller is not physical-device evidence.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const mounted: ReactTestRenderer[] = [];
afterEach(async () => { for (const root of mounted.splice(0)) await act(async () => root.unmount()); });
const key = 'clinical-shift-scratchpad/jobs/v1';
const draft = 'New synthetic task ' + 'N'.repeat(1900);
type Mutation = 'set' | 'remove';

const setup = () => {
  const values = new Map<string, string>();
  let rootKey = '';
  let fault: Mutation | undefined;
  let afterPurge = false;
  let committedRoots = 0;
  let rootReads = 0;
  let injected = false;
  let blockReconciliation = false;
  const native = {
    async getItemAsync(key: string) {
      if (injected && blockReconciliation) throw new Error('synthetic reconciliation read failure');
      if (key === rootKey) rootReads += 1;
      if (fault === 'remove' && key === rootKey && rootReads === (afterPurge ? 3 : 2) && !injected) {
        injected = true;
        throw new Error('synthetic pre-delete read failure');
      }
      return values.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string) {
      if (fault === 'set' && key.includes('Chunk') && committedRoots === (afterPurge ? 1 : 0) && !injected) {
        injected = true;
        throw new Error('synthetic staging failure');
      }
      values.set(key, value);
      if (key === rootKey) committedRoots += 1;
    },
    async deleteItemAsync(key: string) {
      values.delete(key);
      if (key === rootKey) committedRoots += 1;
    },
  };
  const cache = new Map<string, any>();
  const load = (file: string): any => {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, { exports, console, require: (name: string) => {
      if (name === 'expo-secure-store') return native;
      if (!name.startsWith('.')) return require(name);
      return load(path.resolve(path.dirname(file), name + '.ts'));
    } }, { filename: file });
    return exports;
  };
  const { JobStore } = load(path.resolve('src/services/jobStore.ts')) as typeof import('../src/services/jobStore');
  const { encryptedStorageDriver, getSecureStoreKey } = load(path.resolve('src/services/storage.ts')) as typeof import('../src/services/storage');
  const { useAsyncAction } = load(path.resolve('src/useAsyncAction.ts')) as typeof import('../src/useAsyncAction');
  rootKey = getSecureStoreKey(key);
  let now = Date.parse('2026-05-25T12:00:00Z');
  const store = new JobStore(encryptedStorageDriver, () => now);
  return {
    store, useAsyncAction,
    advance: (hours: number) => { now += hours * 60 * 60 * 1000; },
    arm: (kind: Mutation, purge: boolean, blockReads = false) => {
      fault = kind; afterPurge = purge; blockReconciliation = blockReads;
      committedRoots = 0; rootReads = 0;
    },
    resumeReads: () => { blockReconciliation = false; },
    injected: () => injected,
    roots: () => committedRoots,
    persisted: () => encryptedStorageDriver.getItem(key).then((raw) => raw ?? '[]'),
  };
};

const mountController = async (harness: ReturnType<typeof setup>, kind: Mutation) => {
  let actions!: ReturnType<typeof harness.useAsyncAction>;
  let error: unknown;
  let reloads = 0;
  function Controller() {
    const [jobs, setJobs] = React.useState<ClinicalJob[]>([]);
    const [input, setInput] = React.useState(draft);
    const reconcile = React.useCallback(async () => {
      reloads += 1;
      const [saved] = await Promise.all([harness.store.getJobs(), harness.store.getSettings()]);
      setJobs(saved);
    }, []);
    actions = harness.useAsyncAction(reconcile);
    const save = () => actions.run('Saving', async () => {
      try {
        if (kind === 'set') {
          setJobs(await harness.store.addJob({ taskText: input, urgency: 'soon' }));
          setInput('');
        } else {
          setJobs((await harness.store.wipeAllWithUndo()).jobs);
        }
      } catch (caught) { error = caught; throw caught; }
    });
    return <><input value={input} readOnly /><output>{JSON.stringify(jobs)}</output><button disabled={actions.blocked} onClick={save}>Save</button></>;
  }
  let root!: ReactTestRenderer;
  await act(async () => { root = create(<Controller />); });
  mounted.push(root);
  await act(async () => { await actions.reload(); });
  return {
    actions: () => actions,
    error: () => error,
    reloads: () => reloads,
    visible: () => root.root.findByType('output').children.join(''),
    input: () => root.root.findByType('input').props.value,
    disabled: () => root.root.findByType('button').props.disabled,
    save: () => act(async () => { await root.root.findByType('button').props.onClick(); }),
    acknowledge: () => act(async () => actions.acknowledge()),
    reload: () => act(async () => { await actions.reload(); }),
  };
};

const seed = async (harness: ReturnType<typeof setup>) => {
  await harness.store.addJob({ taskText: 'Expiring synthetic task', urgency: 'soon' });
  harness.advance(12);
  const [live] = await harness.store.addJob({ taskText: 'Live synthetic task ' + 'L'.repeat(1900), urgency: 'soon' });
  return live;
};

describe('expiry purge command recovery', () => {
  it.each(['set', 'remove'] as const)('reconciles a committed purge before retry of a later precommit %s failure', async (kind) => {
    const harness = setup();
    const live = await seed(harness);
    const app = await mountController(harness, kind);
    harness.advance(13);
    harness.arm(kind, true);
    await app.save();

    expect(harness.injected()).toBe(true);
    expect(harness.roots()).toBe(1);
    expect(await harness.persisted()).toBe(JSON.stringify([live]));
    expect(app.error()).toMatchObject({ outcome: 'unknown' });
    expect(app.visible()).toBe(await harness.persisted());
    expect(app.input()).toBe(draft);
    expect(app.reloads()).toBe(2);
    expect(app.actions().state).toMatchObject({ phase: 'reconciled', recovery: 'review' });
    expect(app.actions().state.message).toContain('nothing was retried');
    expect(app.actions().busy).toBe(false);
    expect(app.disabled()).toBe(true);
    // Even invoking the disabled callback cannot replay the failed operation.
    await app.save();
    expect(harness.roots()).toBe(1);
    expect(app.visible()).toBe(await harness.persisted());
    expect(app.input()).toBe(draft);
    await app.acknowledge();
    expect(app.disabled()).toBe(false);
    expect(harness.roots()).toBe(1);
    await app.save();
    expect(app.actions().state.phase).toBe('idle');
    expect(app.visible()).toBe(await harness.persisted());
    const saved = JSON.parse(await harness.persisted()) as ClinicalJob[];
    expect(saved.map((job) => job.taskText)).toEqual(kind === 'set' ? [draft, live.taskText] : []);
  });

  it.each(['set', 'remove'] as const)('preserves input and both lists for a genuinely precommit %s failure', async (kind) => {
    const harness = setup();
    await seed(harness);
    const app = await mountController(harness, kind);
    const before = await harness.persisted();
    // Prior successful commands must not contaminate this command's outcome.
    harness.arm(kind, false);
    await app.save();
    expect(harness.injected()).toBe(true);
    expect(harness.roots()).toBe(0);
    expect(app.error()).toMatchObject({ outcome: 'not-committed' });
    expect(await harness.persisted()).toBe(before);
    expect(app.visible()).toBe(before);
    expect(app.input()).toBe(draft);
    expect(app.reloads()).toBe(1);
    expect(app.actions().state).toMatchObject({ phase: 'failed', recovery: 'none' });
    expect(app.actions().state.message).toContain('not saved');
    expect(app.actions().busy).toBe(false);
    expect(app.disabled()).toBe(false);
    await app.save();
    expect(app.actions().state.phase).toBe('idle');
    expect(app.visible()).toBe(await harness.persisted());
    expect(JSON.parse(await harness.persisted())).toHaveLength(kind === 'set' ? 3 : 0);
  });

  it('keeps partial-commit recovery blocked until a failed reconciliation can reload', async () => {
    const harness = setup();
    const live = await seed(harness);
    const app = await mountController(harness, 'set');
    const before = app.visible();
    harness.advance(13);
    harness.arm('set', true, true);
    await app.save();
    expect(harness.injected()).toBe(true);
    expect(app.actions().state).toMatchObject({ phase: 'failed', recovery: 'reload' });
    expect(app.actions().busy).toBe(false);
    expect(app.visible()).toBe(before);
    expect(app.input()).toBe(draft);
    expect(app.disabled()).toBe(true);
    await app.acknowledge();
    await app.save();
    expect(harness.roots()).toBe(1);
    harness.resumeReads();
    await app.reload();
    expect(app.actions().state.recovery).toBe('review');
    expect(app.visible()).toBe(JSON.stringify([live]));
    expect(app.visible()).toBe(await harness.persisted());
    expect(app.input()).toBe(draft);
    expect(app.disabled()).toBe(true);
  });
});
