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
  jobType: patch.jobType,
  pinned: patch.pinned,
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

    expect(await store.saveSettings({ autoDeleteHours: -1 })).toEqual({
      autoDeleteHours: 24,
      locationShortcuts: ['TCI'],
      noteShortcuts: ['M', 'F', 'Hb', 'WCC', 'CRP', 'Na', 'K', 'Cr', 'eGFR', 'INR', 'lactate', 'abdo pain'],
      compactMode: false,
      appearanceMode: 'system',
      currentShiftStartedAt: undefined,
      statusPhraseShortcuts: ['awaiting bloods', 'awaiting CT', 'awaiting reg review', 'family updated', 'discharge letter pending', 'meds prescribed', 'cannula done', 'fluids up'],
      hapticsEnabled: true,
    });
    expect(await store.saveSettings({ autoDeleteHours: 500 })).toEqual({
      autoDeleteHours: 168,
      locationShortcuts: ['TCI'],
      noteShortcuts: ['M', 'F', 'Hb', 'WCC', 'CRP', 'Na', 'K', 'Cr', 'eGFR', 'INR', 'lactate', 'abdo pain'],
      compactMode: false,
      appearanceMode: 'system',
      currentShiftStartedAt: undefined,
      statusPhraseShortcuts: ['awaiting bloods', 'awaiting CT', 'awaiting reg review', 'family updated', 'discharge letter pending', 'meds prescribed', 'cannula done', 'fluids up'],
      hapticsEnabled: true,
    });
  });

  it('normalises editable location shortcuts', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    const saved = await store.saveSettings({ autoDeleteHours: 24, locationShortcuts: [' TCI ', 'A7', 'A7', '', 'C5'] });

    expect(saved.locationShortcuts).toEqual(['TCI', 'A7', 'C5']);
  });

  it('normalises editable note shortcuts independently of location shortcuts', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    const saved = await store.saveSettings({ autoDeleteHours: 24, noteShortcuts: [' M ', 'F', 'Hb', 'Hb', '', 'CT TAP'] });

    expect(saved.noteShortcuts).toEqual(['M', 'F', 'Hb', 'CT TAP']);
    expect(saved.locationShortcuts).toEqual(['TCI']);
  });

  it('keeps a larger note shortcut library while the UI uses the first 8 as radial favourites', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);
    const shortcuts = Array.from({ length: 30 }, (_, index) => `shortcut-${index + 1}`);

    const saved = await store.saveSettings({ autoDeleteHours: 24, noteShortcuts: shortcuts });

    expect(saved.noteShortcuts).toHaveLength(24);
    expect(saved.noteShortcuts.slice(0, 8)).toEqual(shortcuts.slice(0, 8));
    expect(saved.noteShortcuts.at(-1)).toBe('shortcut-24');
  });



  it('persists compact mode setting independently', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    const saved = await store.saveSettings({ autoDeleteHours: 24, compactMode: true });

    expect(saved.compactMode).toBe(true);
    expect(saved.appearanceMode).toBe('system');
    expect(saved.locationShortcuts).toEqual(['TCI']);
  });

  it('persists valid appearance mode and falls back to system for invalid values', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    expect((await store.saveSettings({ autoDeleteHours: 24, appearanceMode: 'dark' })).appearanceMode).toBe('dark');
    expect((await store.saveSettings({ autoDeleteHours: 24, appearanceMode: 'sepia' as never })).appearanceMode).toBe('system');
  });

  it('creates, toggles, bumps, and duplicates lightweight workflow metadata', async () => {
    const storage = new MemoryStorage();
    let now = fixed.getTime();
    const store = new JobStore(storage, () => now);

    let jobs = await store.addJob({ taskText: 'Review bloods', location: 'A7', urgency: 'soon', jobType: 'bloods' });
    expect(jobs[0].jobType).toBe('bloods');
    expect(jobs[0].pinned).toBe(false);

    jobs = await store.togglePinned(jobs[0].id);
    expect(jobs[0].pinned).toBe(true);

    now += 60_000;
    jobs = await store.bumpJob(jobs[0].id);
    expect(jobs[0].updatedAt).toBe('2026-05-25T12:01:00.000Z');

    now += 60_000;
    jobs = await store.duplicateJob(jobs[0].id);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).not.toBe(jobs[1].id);
    expect(jobs[0].taskText).toBe('Review bloods');
    expect(jobs[0].location).toBe('A7');
    expect(jobs[0].jobType).toBe('bloods');
    expect(jobs[0].pinned).toBe(false);
  });


  it('normalises shift settings and status phrase shortcuts', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage);

    const saved = await store.saveSettings({
      autoDeleteHours: 24,
      currentShiftStartedAt: 'not-a-date',
      statusPhraseShortcuts: [' awaiting CT ', 'awaiting CT', '', 'reg aware'],
      hapticsEnabled: false,
    });

    expect(saved.currentShiftStartedAt).toBeUndefined();
    expect(saved.statusPhraseShortcuts).toEqual(['awaiting CT', 'reg aware']);
    expect(saved.hapticsEnabled).toBe(false);
  });

  it('creates jobs with waiting-for text and updates chase metadata', async () => {
    const storage = new MemoryStorage();
    let now = fixed.getTime();
    const store = new JobStore(storage, () => now);

    let jobs = await store.addJob({ taskText: 'Review CT', urgency: 'soon', waitingFor: ' CT report ' });
    expect(jobs[0].waitingFor).toBe('CT report');
    expect(jobs[0].chaseCount).toBeUndefined();

    now += 5 * 60_000;
    jobs = await store.chaseJob(jobs[0].id);

    expect(jobs[0].waitingFor).toBe('CT report');
    expect(jobs[0].lastChasedAt).toBe('2026-05-25T12:05:00.000Z');
    expect(jobs[0].chaseCount).toBe(1);
    expect(jobs[0].updatedAt).toBe('2026-05-25T12:05:00.000Z');
  });

  it('starts and ends a local shift in settings without changing jobs', async () => {
    const storage = new MemoryStorage();
    const store = new JobStore(storage, () => fixed.getTime());

    const started = await store.startShift();
    expect(started.currentShiftStartedAt).toBe('2026-05-25T12:00:00.000Z');

    const ended = await store.endShift();
    expect(ended.currentShiftStartedAt).toBeUndefined();
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
