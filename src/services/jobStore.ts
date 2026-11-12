import { AppSettings, ClinicalJob, DEFAULT_APPEARANCE_MODE, DEFAULT_AUTO_DELETE_HOURS, DEFAULT_COMPACT_MODE, DEFAULT_LOCATION_SHORTCUTS, DEFAULT_NOTE_SHORTCUTS, DEFAULT_STATUS_PHRASE_SHORTCUTS, MAX_NOTE_SHORTCUTS, MAX_STATUS_PHRASE_SHORTCUTS, JobDraft, JobStatus } from '../types/job';
import { encryptedStorageDriver, StorageDriver, StorageMutationError } from './storage';

const JOBS_KEY = 'clinical-shift-scratchpad/jobs/v1';
const SETTINGS_KEY = 'clinical-shift-scratchpad/settings/v1';

const hoursToMs = (hours: number) => hours * 60 * 60 * 1000;

const safeJsonParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normaliseShortcutList = (value: unknown, fallback: string[], limit = 12): string[] => {
  const source = Array.isArray(value) ? value : fallback;
  const cleaned = source
    .map((item) => String(item).trim())
    .filter(Boolean);
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique.slice(0, limit) : fallback.slice(0, limit);
};

const isValidIso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime());

const normaliseSettings = (settings: Partial<AppSettings> | null | undefined): AppSettings => {
  const candidate = Number(settings?.autoDeleteHours);
  return {
    autoDeleteHours: Number.isFinite(candidate) && candidate > 0 ? Math.min(candidate, 168) : DEFAULT_AUTO_DELETE_HOURS,
    locationShortcuts: normaliseShortcutList(settings?.locationShortcuts, DEFAULT_LOCATION_SHORTCUTS),
    noteShortcuts: normaliseShortcutList(settings?.noteShortcuts, DEFAULT_NOTE_SHORTCUTS, MAX_NOTE_SHORTCUTS),
    compactMode: typeof settings?.compactMode === 'boolean' ? settings.compactMode : DEFAULT_COMPACT_MODE,
    appearanceMode: settings?.appearanceMode === 'light' || settings?.appearanceMode === 'dark' || settings?.appearanceMode === 'system' ? settings.appearanceMode : DEFAULT_APPEARANCE_MODE,
    currentShiftStartedAt: isValidIso(settings?.currentShiftStartedAt) ? settings.currentShiftStartedAt : undefined,
    statusPhraseShortcuts: normaliseShortcutList(settings?.statusPhraseShortcuts, DEFAULT_STATUS_PHRASE_SHORTCUTS, MAX_STATUS_PHRASE_SHORTCUTS),
    hapticsEnabled: typeof settings?.hapticsEnabled === 'boolean' ? settings.hapticsEnabled : true,
  };
};

const generateId = (): string => {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
};

export const isExpired = (job: ClinicalJob, nowMs = Date.now()): boolean => {
  const expires = new Date(job.expiresAt).getTime();
  return Number.isFinite(expires) && expires <= nowMs;
};

export const createJob = (draft: JobDraft, autoDeleteHours = DEFAULT_AUTO_DELETE_HOURS, now = new Date()): ClinicalJob => {
  const createdAt = now.toISOString();
  return {
    id: generateId(),
    patientIdentifier: draft.patientIdentifier?.trim() || undefined,
    location: draft.location?.trim() || undefined,
    taskText: draft.taskText.trim(),
    urgency: draft.urgency,
    jobType: draft.jobType,
    pinned: false,
    waitingFor: draft.waitingFor?.trim() || undefined,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(now.getTime() + hoursToMs(autoDeleteHours)).toISOString(),
  };
};

export type UndoableJobChange = {
  jobs: ClinicalJob[];
  // The exact issued array is a revision-bound, single-use undo handle. Copies
  // and records from a previous JobStore instance cannot authorize restoration.
  undoJobs: ClinicalJob[];
};

export class StaleUndoError extends Error {
  constructor() {
    super('Undo unavailable: jobs changed or expired. Your current list has been kept.');
  }
}

export class JobStore {
  private pending: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private successfulWrites = 0;
  // Preserve restoreJobs(undoJobs), but treat the issued array identity as an
  // in-memory token. Never trust caller-editable snapshots as replacement data.
  private undoRecords = new WeakMap<ClinicalJob[], { revision: number; before: string; after: string | null }>();

  constructor(private storage: StorageDriver = encryptedStorageDriver, private nowMs: () => number = Date.now) {}

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(async () => {
      const writesBefore = this.successfulWrites;
      try {
        return await operation();
      } catch (error) {
        // A purge may have committed before a later write failed to stage.
        // The last IO's precommit receipt is not a whole-command rollback.
        if (this.successfulWrites !== writesBefore && error instanceof StorageMutationError && error.outcome === 'not-committed') {
          throw new StorageMutationError('unknown', error);
        }
        throw error;
      }
    });
    this.pending = result.catch(() => undefined);
    return result;
  }

  // Internal helpers never enqueue: the public command owns the whole operation.
  private async readSettings(): Promise<AppSettings> {
    const raw = await this.storage.getItem(SETTINGS_KEY);
    return normaliseSettings(safeJsonParse<Partial<AppSettings> | null>(raw, null));
  }

  private async writeSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const normalised = normaliseSettings(settings);
    await this.storage.setItem(SETTINGS_KEY, JSON.stringify(normalised));
    this.successfulWrites += 1;
    return normalised;
  }

  private async readJobs(): Promise<ClinicalJob[]> {
    const raw = await this.storage.getItem(JOBS_KEY);
    const jobs: ClinicalJob[] = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(jobs)) throw new Error('Invalid stored job list');
    const active = jobs.filter((job) => !isExpired(job, this.nowMs()));
    if (active.length !== jobs.length) await this.writeJobs(active);
    return active;
  }

  private async writeJobs(jobs: ClinicalJob[]): Promise<void> {
    // A rejected write may have committed. Invalidate older undo even on failure.
    this.revision += 1;
    await this.storage.setItem(JOBS_KEY, JSON.stringify(jobs));
    this.successfulWrites += 1;
  }

  private async removeJobs(): Promise<void> {
    this.revision += 1;
    await this.storage.removeItem(JOBS_KEY);
    this.successfulWrites += 1;
  }

  private undoChange(jobs: ClinicalJob[], undoJobs: ClinicalJob[], after = JSON.stringify(jobs)): UndoableJobChange {
    this.undoRecords.set(undoJobs, { revision: this.revision, before: JSON.stringify(undoJobs), after });
    return { jobs, undoJobs };
  }

  getSettings(): Promise<AppSettings> {
    return this.serialize(() => this.readSettings());
  }

  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return this.serialize(() => this.writeSettings(settings));
  }

  getJobs(): Promise<ClinicalJob[]> {
    return this.serialize(() => this.readJobs());
  }

  saveJobs(jobs: ClinicalJob[]): Promise<void> {
    return this.serialize(() => this.writeJobs(jobs));
  }

  addJob(draft: JobDraft): Promise<ClinicalJob[]> {
    return this.serialize(async () => {
      const settings = await this.readSettings();
      const jobs = await this.readJobs();
      const next = [createJob(draft, settings.autoDeleteHours, new Date(this.nowMs())), ...jobs];
      await this.writeJobs(next);
      return next;
    });
  }

  updateJob(id: string, patch: Partial<Omit<ClinicalJob, 'id' | 'createdAt'>>): Promise<ClinicalJob[]> {
    return this.serialize(async () => {
      const jobs = await this.readJobs();
      const updatedAt = new Date(this.nowMs()).toISOString();
      const next = jobs.map((job) => (job.id === id ? { ...job, ...patch, updatedAt } : job));
      await this.writeJobs(next);
      return next;
    });
  }

  restoreJobs(undoJobs: ClinicalJob[]): Promise<ClinicalJob[]> {
    return this.serialize(async () => {
      const record = this.undoRecords.get(undoJobs);
      const current = await this.storage.getItem(JOBS_KEY);
      const jobs: ClinicalJob[] = record ? JSON.parse(record.before) : [];
      if (!record || record.revision !== this.revision || record.after !== current
        || jobs.some((job) => isExpired(job, this.nowMs()))) {
        this.undoRecords.delete(undoJobs);
        throw new StaleUndoError();
      }
      this.undoRecords.delete(undoJobs);
      try {
        await this.writeJobs(jobs);
      } catch (error) {
        // Only a definite precommit failure can retain this one undo handle.
        // Unknown/postcommit outcomes remain consumed; never replay them.
        if (error instanceof StorageMutationError && error.outcome === 'not-committed') {
          this.undoRecords.set(undoJobs, { ...record, revision: this.revision });
        }
        throw error;
      }
      return jobs;
    });
  }

  setStatus(id: string, status: JobStatus): Promise<ClinicalJob[]> {
    return this.updateJob(id, { status });
  }

  togglePinned(id: string): Promise<ClinicalJob[]> {
    return this.serialize(async () => {
      const jobs = await this.readJobs();
      const updatedAt = new Date(this.nowMs()).toISOString();
      const next = jobs.map((job) => (job.id === id ? { ...job, pinned: !job.pinned, updatedAt } : job));
      await this.writeJobs(next);
      return next;
    });
  }

  bumpJob(id: string): Promise<ClinicalJob[]> {
    return this.updateJob(id, {});
  }

  chaseJob(id: string): Promise<ClinicalJob[]> {
    return this.serialize(async () => {
      const jobs = await this.readJobs();
      const updatedAt = new Date(this.nowMs()).toISOString();
      const next = jobs.map((job) => (job.id === id ? { ...job, updatedAt, lastChasedAt: updatedAt, chaseCount: (job.chaseCount ?? 0) + 1 } : job));
      await this.writeJobs(next);
      return next;
    });
  }

  startShift(): Promise<AppSettings> {
    return this.serialize(async () => {
      const settings = await this.readSettings();
      return this.writeSettings({ ...settings, currentShiftStartedAt: new Date(this.nowMs()).toISOString() });
    });
  }

  endShift(): Promise<AppSettings> {
    return this.serialize(async () => {
      const settings = await this.readSettings();
      return this.writeSettings({ ...settings, currentShiftStartedAt: undefined });
    });
  }

  duplicateJob(id: string): Promise<ClinicalJob[]> {
    return this.serialize(async () => {
      const settings = await this.readSettings();
      const jobs = await this.readJobs();
      const source = jobs.find((job) => job.id === id);
      if (!source) return jobs;
      const duplicate = createJob({
        taskText: source.taskText,
        patientIdentifier: source.patientIdentifier,
        location: source.location,
        urgency: source.urgency,
        jobType: source.jobType,
        waitingFor: source.waitingFor,
      }, settings.autoDeleteHours, new Date(this.nowMs()));
      const next = [duplicate, ...jobs];
      await this.writeJobs(next);
      return next;
    });
  }

  setStatusWithUndo(id: string, status: JobStatus): Promise<UndoableJobChange> {
    return this.serialize(async () => {
      const undoJobs = await this.readJobs();
      const updatedAt = new Date(this.nowMs()).toISOString();
      const jobs = undoJobs.map((job) => (job.id === id ? { ...job, status, updatedAt } : job));
      await this.writeJobs(jobs);
      return this.undoChange(jobs, undoJobs);
    });
  }

  async deleteJob(id: string): Promise<ClinicalJob[]> {
    const change = await this.deleteJobWithUndo(id);
    return change.jobs;
  }

  deleteJobWithUndo(id: string): Promise<UndoableJobChange> {
    return this.serialize(async () => {
      const undoJobs = await this.readJobs();
      const jobs = undoJobs.filter((job) => job.id !== id);
      await this.writeJobs(jobs);
      return this.undoChange(jobs, undoJobs);
    });
  }

  async clearCompleted(): Promise<ClinicalJob[]> {
    const change = await this.clearCompletedWithUndo();
    return change.jobs;
  }

  clearCompletedWithUndo(): Promise<UndoableJobChange> {
    return this.serialize(async () => {
      const undoJobs = await this.readJobs();
      const jobs = undoJobs.filter((job) => job.status !== 'done');
      await this.writeJobs(jobs);
      return this.undoChange(jobs, undoJobs);
    });
  }

  wipeAll(): Promise<void> {
    return this.serialize(() => this.removeJobs());
  }

  wipeAllWithUndo(): Promise<UndoableJobChange> {
    return this.serialize(async () => {
      const undoJobs = await this.readJobs();
      await this.removeJobs();
      this.undoRecords.set(undoJobs, { revision: this.revision, before: JSON.stringify(undoJobs), after: null });
      return { jobs: [], undoJobs };
    });
  }
}

export const jobStore = new JobStore();
