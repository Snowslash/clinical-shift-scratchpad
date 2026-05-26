import { describe, expect, it } from 'vitest';
import { ClinicalJob } from '../types/job';
import { JobStore, createJob, isExpired } from './jobStore';
import { StorageDriver } from './storage';

class MemoryStorage implements StorageDriver {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

const fixed = new Date('2026-05-25T12:00:00.000Z');

const job = (patch: Partial<ClinicalJob>): ClinicalJob => ({
  id: patch.id ?? 'job-1',
  taskText: patch.taskText ?? 'Review bloods',
  urgency: patch.urgency ?? 'soon',
  status: patch.status ?? 'pending',
  createdAt: patch.createdAt ?? fixed.toISOString(),
  updatedAt: patch.updatedAt ?? fixed.toISOString(),
  expiresAt: patch.expiresAt ?? new Date(fixed.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  patientIdentifier: patch.patientIdentifier,
  location: patch.location,
});

describe('job creation and expiry', () => {
  it('trims optional identifiers and sets default pending status plus expiry', () => {
    const created = createJob({ taskText: '  Chase CT  ', patientIdentifier: '  Bed 4  ', location: '  C7  ', urgency: 'urgent' }, 6, fixed);

    expect(created.taskText).toBe('Chase CT');
    expect(created.patientIdentifier).toBe('Bed 4');
    expect(created.location).toBe('C7');
    expect(created.status).toBe('pending');
    expect(created.expiresAt).toBe('2026-05-25T18:00:00.000Z');
  });

  it('detects expired jobs at or after expiresAt', () => {
    const expired = job({ expiresAt: '2026-05-25T12:00:00.000Z' });
    expect(isExpired(expired, fixed.getTime())).toBe(true);
  });
});

describe('JobStore', () => {
  it('purges expired jobs when loading and persists the purge', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage, () => fixed.getTime());
    const active = job({ id: 'active', expiresAt: '2026-05-25T13:00:00.000Z' });
    const expired = job({ id: 'expired', expiresAt: '2026-05-25T11:00:00.000Z' });

    await store.saveJobs([active, expired]);
    const loaded = await store.getJobs();

    expect(loaded.map((item) => item.id)).toEqual(['active']);
    expect(JSON.parse([...storage.values.values()][0]).map((item: ClinicalJob) => item.id)).toEqual(['active']);
  });

  it('normalises invalid and excessive auto-delete settings', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    expect(await store.saveSettings({ autoDeleteHours: -1 })).toEqual({ autoDeleteHours: 24, locationShortcuts: ['TCI'] });
    expect(await store.saveSettings({ autoDeleteHours: 500 })).toEqual({ autoDeleteHours: 168, locationShortcuts: ['TCI'] });
  });

  it('normalises editable location shortcuts', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    const saved = await store.saveSettings({ autoDeleteHours: 24, locationShortcuts: [' TCI ', 'A7', 'A7', '', 'C5'] });

    expect(saved.locationShortcuts).toEqual(['TCI', 'A7', 'C5']);
  });

  it('returns a restorable snapshot when deleting a job', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage, () => fixed.getTime());
    await store.saveJobs([job({ id: 'keep' }), job({ id: 'delete-me' })]);

    const change = await store.deleteJobWithUndo('delete-me');

    expect(change.jobs.map((item) => item.id)).toEqual(['keep']);
    expect(change.undoJobs.map((item) => item.id)).toEqual(['keep', 'delete-me']);
    await store.restoreJobs(change.undoJobs);
    expect((await store.getJobs()).map((item) => item.id)).toEqual(['keep', 'delete-me']);
  });

  it('returns a restorable snapshot when clearing completed jobs', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage, () => fixed.getTime());
    await store.saveJobs([job({ id: 'done', status: 'done' }), job({ id: 'pending', status: 'pending' })]);

    const change = await store.clearCompletedWithUndo();

    expect(change.jobs.map((item) => item.id)).toEqual(['pending']);
    expect(change.undoJobs.map((item) => item.id)).toEqual(['done', 'pending']);
    await store.restoreJobs(change.undoJobs);
    expect((await store.getJobs()).map((item) => item.id)).toEqual(['done', 'pending']);
  });

  it('returns a restorable snapshot when marking a job done', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage, () => fixed.getTime());
    await store.saveJobs([job({ id: 'review', status: 'pending' })]);

    const change = await store.setStatusWithUndo('review', 'done');

    expect(change.jobs[0].status).toBe('done');
    expect(change.undoJobs[0].status).toBe('pending');
    await store.restoreJobs(change.undoJobs);
    expect((await store.getJobs())[0].status).toBe('pending');
  });

  it('returns a restorable snapshot when wiping all jobs', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage, () => fixed.getTime());
    await store.saveJobs([job({ id: 'one' }), job({ id: 'two' })]);

    const change = await store.wipeAllWithUndo();

    expect(change.jobs).toEqual([]);
    expect(change.undoJobs.map((item) => item.id)).toEqual(['one', 'two']);
    await store.restoreJobs(change.undoJobs);
    expect((await store.getJobs()).map((item) => item.id)).toEqual(['one', 'two']);
  });
});
