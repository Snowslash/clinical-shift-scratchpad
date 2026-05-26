import { AppSettings, ClinicalJob, DEFAULT_AUTO_DELETE_HOURS, DEFAULT_LOCATION_SHORTCUTS, JobDraft, JobStatus } from '../types/job';
import { encryptedStorageDriver, StorageDriver } from './storage';

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

const normaliseShortcutList = (value: unknown): string[] => {
  const source = Array.isArray(value) ? value : DEFAULT_LOCATION_SHORTCUTS;
  const cleaned = source
    .map((item) => String(item).trim())
    .filter(Boolean);
  const unique = Array.from(new Set(cleaned));
  return unique.length > 0 ? unique.slice(0, 12) : DEFAULT_LOCATION_SHORTCUTS;
};

const normaliseSettings = (settings: Partial<AppSettings> | null | undefined): AppSettings => {
  const candidate = Number(settings?.autoDeleteHours);
  return {
    autoDeleteHours: Number.isFinite(candidate) && candidate > 0 ? Math.min(candidate, 168) : DEFAULT_AUTO_DELETE_HOURS,
    locationShortcuts: normaliseShortcutList(settings?.locationShortcuts),
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
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(now.getTime() + hoursToMs(autoDeleteHours)).toISOString(),
  };
};

export type UndoableJobChange = {
  jobs: ClinicalJob[];
  undoJobs: ClinicalJob[];
};

export class JobStore {
  constructor(private storage: StorageDriver = encryptedStorageDriver, private nowMs: () => number = Date.now) {}

  async getSettings(): Promise<AppSettings> {
    const raw = await this.storage.getItem(SETTINGS_KEY);
    return normaliseSettings(safeJsonParse<Partial<AppSettings> | null>(raw, null));
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const normalised = normaliseSettings(settings);
    await this.storage.setItem(SETTINGS_KEY, JSON.stringify(normalised));
    return normalised;
  }

  async getJobs(): Promise<ClinicalJob[]> {
    const raw = await this.storage.getItem(JOBS_KEY);
    const jobs = safeJsonParse<ClinicalJob[]>(raw, []);
    const active = Array.isArray(jobs) ? jobs.filter((job) => !isExpired(job, this.nowMs())) : [];
    if (active.length !== jobs.length) {
      await this.saveJobs(active);
    }
    return active;
  }

  async saveJobs(jobs: ClinicalJob[]): Promise<void> {
    await this.storage.setItem(JOBS_KEY, JSON.stringify(jobs));
  }

  async addJob(draft: JobDraft): Promise<ClinicalJob[]> {
    const [settings, jobs] = await Promise.all([this.getSettings(), this.getJobs()]);
    const next = [createJob(draft, settings.autoDeleteHours), ...jobs];
    await this.saveJobs(next);
    return next;
  }

  async updateJob(id: string, patch: Partial<Omit<ClinicalJob, 'id' | 'createdAt'>>): Promise<ClinicalJob[]> {
    const jobs = await this.getJobs();
    const updatedAt = new Date(this.nowMs()).toISOString();
    const next = jobs.map((job) => (job.id === id ? { ...job, ...patch, updatedAt } : job));
    await this.saveJobs(next);
    return next;
  }

  async restoreJobs(jobs: ClinicalJob[]): Promise<ClinicalJob[]> {
    await this.saveJobs(jobs);
    return jobs;
  }

  async setStatus(id: string, status: JobStatus): Promise<ClinicalJob[]> {
    return this.updateJob(id, { status });
  }

  async setStatusWithUndo(id: string, status: JobStatus): Promise<UndoableJobChange> {
    const undoJobs = await this.getJobs();
    const updatedAt = new Date(this.nowMs()).toISOString();
    const jobs = undoJobs.map((job) => (job.id === id ? { ...job, status, updatedAt } : job));
    await this.saveJobs(jobs);
    return { jobs, undoJobs };
  }

  async deleteJob(id: string): Promise<ClinicalJob[]> {
    const change = await this.deleteJobWithUndo(id);
    return change.jobs;
  }

  async deleteJobWithUndo(id: string): Promise<UndoableJobChange> {
    const undoJobs = await this.getJobs();
    const jobs = undoJobs.filter((job) => job.id !== id);
    await this.saveJobs(jobs);
    return { jobs, undoJobs };
  }

  async clearCompleted(): Promise<ClinicalJob[]> {
    const change = await this.clearCompletedWithUndo();
    return change.jobs;
  }

  async clearCompletedWithUndo(): Promise<UndoableJobChange> {
    const undoJobs = await this.getJobs();
    const jobs = undoJobs.filter((job) => job.status !== 'done');
    await this.saveJobs(jobs);
    return { jobs, undoJobs };
  }

  async wipeAll(): Promise<void> {
    await this.storage.removeItem(JOBS_KEY);
  }

  async wipeAllWithUndo(): Promise<UndoableJobChange> {
    const undoJobs = await this.getJobs();
    await this.storage.removeItem(JOBS_KEY);
    return { jobs: [], undoJobs };
  }
}

export const jobStore = new JobStore();
