import { describe, expect, it } from 'vitest';
import { ClinicalJob, JobDraft } from '../types/job';
import { JobStore } from './jobStore';
import { StorageDriver, StorageMutationError } from './storage';

const key = 'clinical-shift-scratchpad/jobs/v1';
const start = Date.parse('2026-05-25T12:00:00Z');
const draft = (taskText: string): JobDraft => ({ taskText, urgency: 'soon' });

// Like the real driver, each IO is serialized. This deliberately does NOT
// serialize a caller's read-transform-write operation on its behalf.
class SerializedStorage implements StorageDriver {
  values = new Map<string, string>();
  private pending: Promise<unknown> = Promise.resolve();
  failNextWrite: 'before' | 'after' | undefined;
  private io<T>(operation: () => T): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => undefined);
    return result;
  }
  getItem(key: string) { return this.io(() => this.values.get(key) ?? null); }
  setItem(key: string, value: string) {
    return this.io(() => {
      const failure = this.failNextWrite;
      this.failNextWrite = undefined;
      if (failure === 'before') throw new Error('precommit failure');
      this.values.set(key, value);
      if (failure === 'after') throw new Error('postcommit failure');
    });
  }
  removeItem(key: string) { return this.io(() => { this.values.delete(key); }); }
  persisted(): ClinicalJob[] { return JSON.parse(this.values.get(key) ?? '[]'); }
}

const setup = () => {
  const storage = new SerializedStorage();
  let now = start;
  const store = new JobStore(storage, () => now);
  return { store, storage, advance: (ms: number) => { now += ms; } };
};
const texts = (jobs: ClinicalJob[]) => jobs.map((job) => job.taskText).sort();

describe('whole-operation job transactions', () => {
  it('retains both overlapping additions in returned and persisted lists', async () => {
    const { store, storage } = setup();
    const [first, second] = await Promise.all([store.addJob(draft('A')), store.addJob(draft('B'))]);
    expect(texts(first)).toEqual(['A']);
    expect(texts(storage.persisted())).toEqual(['A', 'B']);
    expect(texts(second)).toEqual(['A', 'B']);
  });

  it('retains independent overlapping edits to the same task', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    await Promise.all([store.updateJob(a.id, { taskText: 'edited' }), store.updateJob(a.id, { location: 'synthetic' })]);
    expect(storage.persisted()[0]).toMatchObject({ taskText: 'edited', location: 'synthetic' });
    expect(await store.getJobs()).toEqual(storage.persisted());
  });

  it('does not resurrect a deletion during an overlapping addition', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const [, added] = await Promise.all([store.deleteJob(a.id), store.addJob(draft('B'))]);
    expect(texts(storage.persisted())).toEqual(['B']);
    expect(texts(added)).toEqual(['B']);
  });

  it('serializes repeated chase increments and pin toggles', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    await Promise.all([store.chaseJob(a.id), store.chaseJob(a.id), store.togglePinned(a.id), store.togglePinned(a.id)]);
    expect(storage.persisted()[0]).toMatchObject({ chaseCount: 2, pinned: false });
  });

  it('serializes duplication with a concurrent edit', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    await Promise.all([store.updateJob(a.id, { taskText: 'edited' }), store.duplicateJob(a.id)]);
    expect(texts(storage.persisted())).toEqual(['edited', 'edited']);
  });

  it('does not let expiry purge erase an overlapping addition', async () => {
    const { store, storage, advance } = setup();
    await store.addJob(draft('expired'));
    advance(24 * 60 * 60 * 1000);
    const [, added] = await Promise.all([store.getJobs(), store.addJob(draft('B'))]);
    expect(texts(storage.persisted())).toEqual(['B']);
    expect(texts(added)).toEqual(['B']);
  });

  it('returns the committed addition to a following overlapping expiry read', async () => {
    const { store, storage, advance } = setup();
    await store.addJob(draft('expired'));
    advance(24 * 60 * 60 * 1000);
    const [added, loaded] = await Promise.all([store.addJob(draft('B')), store.getJobs()]);
    expect(texts(storage.persisted())).toEqual(['B']);
    expect(loaded).toEqual(added);
  });

  it('includes a preceding whole-list save in a following addition', async () => {
    const { store, storage } = setup();
    const jobs = await store.addJob(draft('A'));
    await store.wipeAll();
    await Promise.all([store.saveJobs(jobs), store.addJob(draft('B'))]);
    expect(texts(storage.persisted())).toEqual(['A', 'B']);
  });

  it('orders a following whole-list save after an in-flight addition', async () => {
    const { store, storage } = setup();
    const jobs = await store.addJob(draft('A'));
    await Promise.all([store.addJob(draft('B')), store.saveJobs(jobs)]);
    expect(texts(storage.persisted())).toEqual(['A']);
  });

  it('orders an add before a wipe without resurrecting the add', async () => {
    const { store, storage } = setup();
    await Promise.all([store.addJob(draft('A')), store.wipeAll()]);
    expect(storage.persisted()).toEqual([]);
  });

  it('orders a wipe before an add without erasing the later add', async () => {
    const { store, storage } = setup();
    await store.addJob(draft('A'));
    await Promise.all([store.wipeAllWithUndo(), store.addJob(draft('B'))]);
    expect(texts(storage.persisted())).toEqual(['B']);
  });

  it('includes a preceding addition in a clear-completed snapshot', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    await store.setStatus(a.id, 'done');
    const [, change] = await Promise.all([store.addJob(draft('B')), store.clearCompletedWithUndo()]);
    expect(texts(storage.persisted())).toEqual(['B']);
    expect(texts(change.undoJobs)).toEqual(['A', 'B']);
  });

  it('orders restore before a concurrent addition', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    const [, added] = await Promise.all([store.restoreJobs(change.undoJobs), store.addJob(draft('B'))]);
    expect(texts(storage.persisted())).toEqual(['A', 'B']);
    expect(texts(added)).toEqual(['A', 'B']);
  });

  it.each(['before', 'after'] as const)('progresses after a %s-commit rejection using durable state', async (failure) => {
    const { store, storage } = setup();
    storage.failNextWrite = failure;
    const [failed, next] = await Promise.allSettled([store.addJob(draft('A')), store.addJob(draft('B'))]);
    expect(failed.status).toBe('rejected');
    expect(next.status).toBe('fulfilled');
    const expected = failure === 'after' ? ['A', 'B'] : ['B'];
    expect(texts(storage.persisted())).toEqual(expected);
    if (next.status === 'fulfilled') expect(texts(next.value)).toEqual(expected);
  });

  it('does not attribute a preceding queued commit to a later precommit failure', async () => {
    const { store, storage } = setup();
    const setItem = storage.setItem.bind(storage);
    let writes = 0;
    storage.setItem = async (key, value) => {
      if (++writes === 2) throw new StorageMutationError('not-committed', 'synthetic staging failure');
      return setItem(key, value);
    };
    const [saved, failed] = await Promise.allSettled([store.addJob(draft('saved')), store.addJob(draft('unsaved'))]);
    expect(saved.status).toBe('fulfilled');
    expect(failed.status).toBe('rejected');
    if (failed.status === 'rejected') expect(failed.reason).toMatchObject({ outcome: 'not-committed' });
    expect(texts(storage.persisted())).toEqual(['saved']);
  });

  it.each([
    ['add', (store: JobStore, id: string) => store.addJob(draft('new'))],
    ['edit', (store: JobStore, id: string) => store.updateJob(id, { taskText: 'edited' })],
    ['pin', (store: JobStore, id: string) => store.togglePinned(id)],
    ['chase', (store: JobStore, id: string) => store.chaseJob(id)],
    ['duplicate', (store: JobStore, id: string) => store.duplicateJob(id)],
    ['status', (store: JobStore, id: string) => store.setStatusWithUndo(id, 'done')],
    ['delete', (store: JobStore, id: string) => store.deleteJobWithUndo(id)],
    ['clear', (store: JobStore, id: string) => store.clearCompletedWithUndo()],
    ['wipe', (store: JobStore, id: string) => store.wipeAllWithUndo()],
  ] as const)('does not report %s as wholly precommit after expiry already committed', async (name, mutate) => {
    const { store, storage, advance } = setup();
    await store.addJob(draft('expired'));
    advance(12 * 60 * 60 * 1000);
    const [live] = await store.addJob(draft('live'));
    await store.setStatus(live.id, 'done');
    const expected = storage.persisted().filter((job) => job.id === live.id);
    advance(13 * 60 * 60 * 1000);
    const setItem = storage.setItem.bind(storage);
    let writes = 0;
    storage.setItem = async (key, value) => {
      if (++writes === 2) throw new StorageMutationError('not-committed', 'synthetic staging failure');
      return setItem(key, value);
    };
    storage.removeItem = async () => { throw new StorageMutationError('not-committed', 'synthetic pre-delete failure'); };

    // Enqueue the read before the mutation settles: the failed command must not
    // poison the queue or replay/resurrect its already committed expiry purge.
    const [failed, loaded] = await Promise.allSettled([mutate(store, live.id), store.getJobs()]);
    expect(failed.status).toBe('rejected');
    if (failed.status === 'rejected') expect(failed.reason).toMatchObject({ outcome: 'unknown' });
    expect(loaded).toEqual({ status: 'fulfilled', value: expected });
    expect(storage.persisted()).toEqual(expected);
    expect(writes).toBe(name === 'wipe' ? 1 : 2);
  });

  it('serializes shift settings with an overlapping settings write', async () => {
    const { store } = setup();
    await Promise.all([store.saveSettings({ compactMode: true }), store.startShift()]);
    expect(await store.getSettings()).toMatchObject({ compactMode: true, currentShiftStartedAt: new Date(start).toISOString() });
  });
});

describe('revision-bound undo', () => {
  it('allows retry of undo only when its write is known not to have committed', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    const originalSet = storage.setItem.bind(storage);
    let fail = true;
    storage.setItem = async (key, value) => {
      if (fail) {
        fail = false;
        throw new StorageMutationError('not-committed', 'synthetic staging failure');
      }
      return originalSet(key, value);
    };
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/not-committed/);
    expect(storage.persisted()).toEqual([]);
    await store.restoreJobs(change.undoJobs);
    expect(texts(storage.persisted())).toEqual(['A']);
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/undo/i);
  });

  it.each(['before', 'after'] as const)('consumes undo after an unclassified %s-commit rejection', async (failure) => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    storage.failNextWrite = failure;
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/failure/);
    const expected = failure === 'after' ? ['A'] : [];
    expect(texts(storage.persisted())).toEqual(expected);
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/undo/i);
    expect(texts(storage.persisted())).toEqual(expected);
  });

  it('refuses delete → add → undo without losing the added task', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    await store.addJob(draft('B'));
    const change = await store.deleteJobWithUndo(a.id);
    await store.addJob(draft('C'));
    const [result] = await Promise.allSettled([store.restoreJobs(change.undoJobs)]);
    expect(texts(storage.persisted())).toEqual(['B', 'C']);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason.message).toMatch(/undo.*(changed|expired)/i);
    expect(texts(await store.getJobs())).toEqual(['B', 'C']);
  });

  it('refuses undo after the same task is edited', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.setStatusWithUndo(a.id, 'done');
    await store.updateJob(a.id, { taskText: 'edited' });
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/undo/i);
    expect(storage.persisted()[0]).toMatchObject({ taskText: 'edited', status: 'done' });
  });

  it('refuses to resurrect an expired deleted task even without a purge', async () => {
    const { store, storage, advance } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    advance(24 * 60 * 60 * 1000);
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/expired/i);
    expect(storage.persisted()).toEqual([]);
  });

  it('invalidates undo when expiry purges another task', async () => {
    const { store, storage, advance } = setup();
    const [a] = await store.addJob(draft('A'));
    await store.addJob(draft('B'));
    const change = await store.deleteJobWithUndo(a.id);
    advance(24 * 60 * 60 * 1000);
    await store.getJobs();
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/undo/i);
    expect(storage.persisted()).toEqual([]);
  });

  it('refuses old records after a newer undo and consumes each token once', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const first = await store.setStatusWithUndo(a.id, 'seen');
    const second = await store.setStatusWithUndo(a.id, 'done');
    await store.restoreJobs(second.undoJobs);
    await expect(store.restoreJobs(first.undoJobs)).rejects.toThrow(/undo/i);
    await expect(store.restoreJobs(second.undoJobs)).rejects.toThrow(/undo/i);
    expect(storage.persisted()[0].status).toBe('seen');
  });

  it('refuses a queued undo when a preceding add changes its revision', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    const [add, undo] = await Promise.allSettled([store.addJob(draft('B')), store.restoreJobs(change.undoJobs)]);
    expect(add.status).toBe('fulfilled');
    expect(undo.status).toBe('rejected');
    expect(texts(storage.persisted())).toEqual(['B']);
  });

  it('refuses snapshots from a previous store instance', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    await expect(new JobStore(storage, () => start).restoreJobs(change.undoJobs)).rejects.toThrow(/undo/i);
    expect(storage.persisted()).toEqual([]);
  });

  it('refuses changed durable contents even without a local revision bump', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    storage.values.set(key, JSON.stringify([{ ...a, taskText: 'external' }]));
    await expect(store.restoreJobs(change.undoJobs)).rejects.toThrow(/undo/i);
    expect(texts(storage.persisted())).toEqual(['external']);
  });

  it('restores the issued snapshot rather than caller-mutated array contents', async () => {
    const { store, storage } = setup();
    const [a] = await store.addJob(draft('A'));
    const change = await store.deleteJobWithUndo(a.id);
    change.undoJobs[0].taskText = 'tampered';
    await store.restoreJobs(change.undoJobs);
    expect(texts(storage.persisted())).toEqual(['A']);
  });
});
