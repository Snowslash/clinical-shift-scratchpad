/// <reference types="node" />
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import * as jobStoreModule from '../src/services/jobStore';
import * as storageModule from '../src/services/storage';

// Real React, App, screens, hook and JobStore. Only native view/device boundaries
// are substituted. This is host interaction evidence, not a device/Keychain test.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const mounted: ReactTestRenderer[] = [];
afterEach(async () => { for (const root of mounted.splice(0)) await act(async () => root.unmount()); });

class TestStorage implements storageModule.StorageDriver {
  values = new Map<string, string>();
  failure?: 'before' | 'after' | 'unknown';
  failReads = false;
  failReconciliation = false;
  gate?: Promise<void>;
  async getItem(key: string) {
    if (this.failReads) throw new Error('synthetic read failure');
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    if (this.gate) await this.gate;
    const failure = this.failure;
    this.failure = undefined;
    if (failure === 'before') throw new storageModule.StorageMutationError('not-committed', 'synthetic staging failure');
    if (failure === 'unknown') throw new Error('unknown adapter outcome');
    this.values.set(key, value);
    if (failure === 'after') {
      if (this.failReconciliation) this.failReads = true;
      throw new storageModule.StorageMutationError('committed', 'synthetic cleanup failure');
    }
  }
  async removeItem(key: string) {
    const failure = this.failure;
    this.failure = undefined;
    if (failure === 'before') throw new storageModule.StorageMutationError('not-committed', 'synthetic pre-delete failure');
    this.values.delete(key);
    if (failure) throw new storageModule.StorageMutationError('committed', 'synthetic post-delete failure');
  }
  jobs() { return JSON.parse(this.values.get('clinical-shift-scratchpad/jobs/v1') ?? '[]'); }
}

type AlertRecord = { title: string; message: string; buttons?: { text: string; onPress?: () => unknown }[] };
const setup = async (options: { loadFailure?: boolean; seeded?: boolean } = {}) => {
  const storage = new TestStorage();
  const store = new jobStoreModule.JobStore(storage);
  if (options.seeded) await store.addJob({ taskText: 'Existing synthetic task', urgency: 'soon' });
  storage.failReads = Boolean(options.loadFailure);
  const alerts: AlertRecord[] = [];
  let clipboardResult: boolean | Error = true;
  let hapticFailure = false;
  let copied = '';
  const native = {
    ...Object.fromEntries(['Text', 'View', 'TouchableOpacity', 'Pressable', 'ScrollView', 'TextInput', 'KeyboardAvoidingView'].map((name) => [name, name])),
    Modal: ({ visible, children }: any) => visible ? React.createElement('Modal', {}, children) : null,
    FlatList: ({ data, renderItem, ListEmptyComponent }: any) => React.createElement('FlatList', {}, data.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id ?? index }, renderItem({ item }))) : ListEmptyComponent),
    Alert: { alert: (title: string, message: string, buttons?: AlertRecord['buttons']) => { alerts.push({ title, message, buttons }); } },
    Platform: { OS: 'ios', select: (options: any) => options.ios ?? options.default },
    StyleSheet: { create: (styles: any) => styles },
    useColorScheme: () => 'light',
  };
  const modules: Record<string, any> = {
    'react-native': native,
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView', LongPressGestureHandler: 'LongPressGestureHandler', State: { ACTIVE: 4 } },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-clipboard': { setStringAsync: async (text: string) => { if (clipboardResult instanceof Error) throw clipboardResult; if (clipboardResult) copied = text; return clipboardResult; } },
    'expo-haptics': { NotificationFeedbackType: { Success: 'success', Warning: 'warning' }, ImpactFeedbackStyle: { Light: 'light' }, notificationAsync: async () => { if (hapticFailure) throw new Error('no haptics'); }, impactAsync: async () => { if (hapticFailure) throw new Error('no haptics'); } },
  };
  const cache = new Map<string, any>([
    [path.resolve('src/services/jobStore.ts'), { ...jobStoreModule, jobStore: store }],
    [path.resolve('src/services/storage.ts'), storageModule],
  ]);
  const load = (file: string): any => {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(source, { exports, setTimeout, clearTimeout, console, require: (name: string) => {
      if (modules[name]) return modules[name];
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(file), name);
      return load([base + '.ts', base + '.tsx'].find(existsSync)!);
    } }, { filename: file });
    return exports;
  };
  const App = load(path.resolve('App.tsx')).default;
  let root!: ReactTestRenderer;
  await act(async () => { root = create(React.createElement(App)); });
  mounted.push(root);
  const text = () => root.root.findAllByType('Text' as any).map((node) => node.children.join('')).join('\n');
  const button = (label: string, last = false): ReactTestInstance => {
    const matches = root.root.findAll((node) => String(node.type) === 'TouchableOpacity' && node.findAllByType('Text' as any).some((text) => text.children.join('') === label));
    expect(matches.length, `button: ${label}`).toBeGreaterThan(0);
    return last ? matches[matches.length - 1] : matches[0];
  };
  const press = async (label: string, last = false) => {
    let rejected: unknown;
    await act(async () => { try { await button(label, last).props.onPress(); } catch (error) { rejected = error; } });
    return rejected;
  };
  const typeTask = async (value: string) => {
    const input = root.root.findAll((node) => String(node.type) === 'TextInput' && Boolean(node.props.multiline))[0];
    await act(async () => input.props.onChangeText(value));
  };
  const confirm = async (label: string) => {
    const action = alerts.at(-1)?.buttons?.find((button) => button.text === label);
    expect(action).toBeDefined();
    let rejected: unknown;
    await act(async () => { try { await action!.onPress?.(); } catch (error) { rejected = error; } });
    return rejected;
  };
  return { root, storage, store, alerts, text, button, press, typeTask, confirm, setClipboard: (value: boolean | Error) => { clipboardResult = value; }, getCopied: () => copied, failHaptics: () => { hapticFailure = true; } };
};

describe('native app action recovery', () => {
  it('allows the same undo to be retried after a known precommit failure', async () => {
    const app = await setup({ seeded: true });
    await app.press('Del');
    await app.confirm('Delete');
    app.storage.failure = 'before';
    expect(await app.press('Undo')).toBeUndefined();
    expect(app.text()).toContain('not saved');
    expect(app.storage.jobs()).toEqual([]);
    expect(await app.press('Undo')).toBeUndefined();
    expect(app.storage.jobs()).toHaveLength(1);
    expect(app.text()).not.toContain('Undo unavailable');
  });

  it.each(['☆', 'Bump', 'Chase', 'Duplicate', 'done'])('contains precommit errors for the %s task action', async (label) => {
    const app = await setup({ seeded: true });
    const before = JSON.stringify(app.storage.jobs());
    app.storage.failure = 'before';
    expect(await app.press(label, true)).toBeUndefined();
    expect(app.text()).toContain('not saved');
    expect(JSON.stringify(app.storage.jobs())).toBe(before);
    expect(await app.press(label, true)).toBeUndefined();
    expect(app.text()).not.toContain('not saved');
  });

  it('keeps an edited draft on failure and stores it on retry', async () => {
    const app = await setup({ seeded: true });
    await app.press('Edit');
    await app.typeTask('Edited synthetic task');
    app.storage.failure = 'before';
    expect(await app.press('Save')).toBeUndefined();
    expect(app.storage.jobs()[0].taskText).toBe('Existing synthetic task');
    expect(app.root.root.findAllByType('TextInput' as any)[0].props.value).toBe('Edited synthetic task');
    expect(await app.press('Save')).toBeUndefined();
    expect(app.storage.jobs()[0].taskText).toBe('Edited synthetic task');
  });

  it('invalidates the single displayed undo after another job write', async () => {
    const app = await setup({ seeded: true });
    await app.press('Del');
    await app.confirm('Delete');
    expect(app.text()).toContain('until next job change or expiry');
    await app.press('Add first job');
    await app.typeTask('Later synthetic task');
    await app.press('Save');
    expect(app.text()).not.toContain('Undo');
    expect(app.storage.jobs().map((job: any) => job.taskText)).toEqual(['Later synthetic task']);
  });

  it.each(['before', 'after'] as const)('recovers a %s-commit delete confirmation', async (failure) => {
    const app = await setup({ seeded: true });
    await app.press('Del');
    app.storage.failure = failure;
    expect(await app.confirm('Delete')).toBeUndefined();
    expect(app.text()).toContain(failure === 'before' ? 'not saved' : 'Saved list reloaded');
    expect(app.storage.jobs()).toHaveLength(failure === 'before' ? 1 : 0);
  });

  it.each(['before', 'after'] as const)('recovers a %s-commit wipe confirmation', async (failure) => {
    const app = await setup({ seeded: true });
    await app.press('review');
    await app.press('Wipe all local jobs');
    app.storage.failure = failure;
    expect(await app.confirm('Wipe all')).toBeUndefined();
    expect(app.text()).toContain(failure === 'before' ? 'not saved' : 'Saved list reloaded');
    expect(app.storage.jobs()).toHaveLength(failure === 'before' ? 1 : 0);
  });

  it('recovers clear-completed failure without changing the completed list', async () => {
    const app = await setup({ seeded: true });
    await app.press('done', true);
    await app.press('Clear completed');
    app.storage.failure = 'before';
    expect(await app.confirm('Clear done')).toBeUndefined();
    expect(app.text()).toContain('not saved');
    expect(app.storage.jobs()[0].status).toBe('done');
    await app.press('Clear completed');
    expect(await app.confirm('Clear done')).toBeUndefined();
    expect(app.storage.jobs()).toEqual([]);
    await app.press('Undo');
    expect(app.storage.jobs()[0].status).toBe('done');
  });

  it.each(['before', 'after'] as const)('recovers a %s-commit settings update', async (failure) => {
    const app = await setup();
    await app.press('settings');
    app.storage.failure = failure;
    expect(await app.press('Dark')).toBeUndefined();
    expect(app.text()).toContain(failure === 'before' ? 'not saved' : 'Saved list reloaded');
    expect((await app.store.getSettings()).appearanceMode).toBe(failure === 'before' ? 'system' : 'dark');
  });

  it('contains shift start/end errors and releases the action boundary', async () => {
    const app = await setup();
    app.storage.failure = 'before';
    expect(await app.press('Start')).toBeUndefined();
    expect(app.text()).toContain('not saved');
    await app.press('Start');
    expect((await app.store.getSettings()).currentShiftStartedAt).toBeDefined();
    await app.press('End');
    app.storage.failure = 'after';
    expect(await app.confirm('End shift')).toBeUndefined();
    expect(app.text()).toContain('Saved list reloaded');
    expect((await app.store.getSettings()).currentShiftStartedAt).toBeUndefined();
  });

  it('keeps a save failure outside the scrolled form fields', async () => {
    const app = await setup();
    await app.press('Add first job');
    await app.typeTask('Synthetic draft');
    app.storage.failure = 'before';
    await app.press('Add + keep open');
    const message = app.root.root.findAllByType('Text' as any).find((node) => node.children.join('').includes('not saved'))!;
    expect(message).toBeDefined();
    const ancestors: string[] = [];
    for (let node = message.parent; node; node = node.parent) ancestors.push(String(node.type));
    expect(ancestors).not.toContain('ScrollView');
  });

  it('terminates failed initial loading and offers a working reload', async () => {
    const app = await setup({ loadFailure: true });
    expect(app.text()).not.toContain('Loading…');
    expect(app.text()).toContain('Could not load saved data');
    await app.press('Add first job');
    expect(app.root.root.findAllByType('Modal' as any)).toHaveLength(0);
    app.storage.failReads = false;
    expect(await app.press('Reload saved data')).toBeUndefined();
    expect(app.text()).not.toContain('Could not load saved data');
    await app.press('Add first job');
    expect(app.root.root.findAllByType('Modal' as any)).toHaveLength(1);
  });

  it('keeps the form and visible list on precommit failure and permits manual retry', async () => {
    const app = await setup({ seeded: true });
    await app.press('+ Quick capture');
    await app.typeTask('Unsaved synthetic task');
    app.storage.failure = 'before';
    const rejected = await app.press('Save');
    expect(app.text()).toContain('not saved');
    expect(rejected).toBeUndefined();
    expect(app.text()).toContain('Existing synthetic task');
    expect(app.root.root.findAllByType('Modal' as any)).toHaveLength(1);
    expect(app.storage.jobs().map((job: any) => job.taskText)).toEqual(['Existing synthetic task']);
    expect(app.button('Save').props.disabled).not.toBe(true);
    expect(await app.press('Save')).toBeUndefined();
    expect(app.storage.jobs()).toHaveLength(2);
    expect(app.root.root.findAllByType('Modal' as any)).toHaveLength(0);
  });

  it.each(['after', 'unknown'] as const)('reconciles %s-commit uncertainty before allowing another save', async (failure) => {
    const app = await setup();
    await app.press('Add first job');
    await app.typeTask('Synthetic draft');
    app.storage.failure = failure;
    const rejected = await app.press('Save');
    expect(app.text()).toContain('Saved list reloaded');
    expect(rejected).toBeUndefined();
    expect(app.root.root.findAllByType('Modal' as any)).toHaveLength(1);
    expect(app.button('Save').props.disabled).toBe(true);
    const expectedCount = failure === 'after' ? 1 : 0;
    expect(app.storage.jobs()).toHaveLength(expectedCount);
    // Even a stale onPress callback cannot bypass reconciliation gating.
    await app.press('Save');
    expect(app.storage.jobs()).toHaveLength(expectedCount);
    await app.press('I checked the saved list');
    expect(app.button('Save').props.disabled).not.toBe(true);
    await app.press('Cancel');
    expect(app.storage.jobs()).toHaveLength(expectedCount);
  });

  it('keeps uncertain recovery read-only when reconciliation fails', async () => {
    const app = await setup();
    await app.press('Add first job');
    await app.typeTask('Synthetic draft');
    app.storage.failure = 'after';
    app.storage.failReconciliation = true;
    await app.press('Save');
    expect(app.text()).toContain('Could not reload saved data');
    expect(app.button('Save').props.disabled).toBe(true);
    await app.press('Save');
    expect(app.storage.jobs()).toHaveLength(1);
    app.storage.failReads = false;
    await app.press('Reload saved data');
    expect(app.text()).toContain('Saved list reloaded');
    expect(app.storage.jobs()).toHaveLength(1);
  });

  it('blocks double taps synchronously and releases pending after success', async () => {
    const app = await setup();
    await app.press('Add first job');
    await app.typeTask('Once only');
    let release!: () => void;
    app.storage.gate = new Promise<void>((resolve) => { release = resolve; });
    const save = app.button('Save').props.onPress;
    let first: unknown;
    let second: unknown;
    await act(async () => { first = save(); second = save(); });
    expect(app.button('Save').props.disabled).toBe(true);
    expect(app.text()).toContain('Saving');
    await act(async () => { release(); await Promise.all([first, second]); });
    expect(app.storage.jobs()).toHaveLength(1);
    expect(app.text()).not.toContain('Saving');
  });

  it('reports stale undo without overwriting the reloaded list', async () => {
    const app = await setup({ seeded: true });
    await app.press('Del');
    expect(await app.confirm('Delete')).toBeUndefined();
    await app.store.addJob({ taskText: 'Intervening synthetic task', urgency: 'soon' });
    expect(await app.press('Undo')).toBeUndefined();
    expect(app.text()).toContain('Undo unavailable');
    expect(app.text()).toContain('Intervening synthetic task');
    expect(app.storage.jobs().map((job: any) => job.taskText)).toEqual(['Intervening synthetic task']);
  });

  it.each([false, new Error('clipboard denied')])('does not confirm an unsuccessful clipboard copy (%s)', async (result) => {
    const app = await setup({ seeded: true });
    await app.press('review');
    await app.press('Copy plain text summary');
    app.setClipboard(result);
    const rejected = await app.confirm('Copy locally');
    expect(app.alerts.some((alert) => alert.title === 'Copied')).toBe(false);
    expect(rejected).toBeUndefined();
    expect(app.text()).toContain('Clipboard copy not confirmed');
    expect(app.getCopied()).toBe('');
  });

  it('confirms successful clipboard output and treats haptics as best-effort', async () => {
    const app = await setup();
    app.failHaptics();
    await app.press('Add first job');
    await app.typeTask('Synthetic draft');
    expect(await app.press('Add + keep open')).toBeUndefined();
    expect(app.storage.jobs()).toHaveLength(1);
    await app.press('Cancel');
    await app.press('review');
    await app.press('Copy plain text summary');
    expect(await app.confirm('Copy locally')).toBeUndefined();
    expect(app.alerts.at(-1)?.title).toBe('Copied');
    expect(app.getCopied()).toContain('Synthetic draft');
  });
});
