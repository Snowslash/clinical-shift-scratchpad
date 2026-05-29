export type Urgency = 'routine' | 'soon' | 'urgent';
export type JobStatus = 'pending' | 'seen' | 'waiting' | 'done';
export type JobFilter = 'all' | JobStatus;
export type SortPreset = 'pinnedFirst' | 'waitingLongest' | 'recentlyTouched' | 'byLocation' | 'byStatus' | 'byTag';
export type JobType = 'review' | 'bloods' | 'imaging' | 'call' | 'family' | 'discharge' | 'prescribing' | 'handover';
export type AppearanceMode = 'system' | 'light' | 'dark';

export interface ClinicalJob {
  id: string;
  patientIdentifier?: string;
  location?: string;
  taskText: string;
  urgency: Urgency;
  jobType?: JobType;
  pinned?: boolean;
  waitingFor?: string;
  lastChasedAt?: string;
  chaseCount?: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface JobDraft {
  patientIdentifier?: string;
  location?: string;
  taskText: string;
  urgency: Urgency;
  jobType?: JobType;
  pinned?: boolean;
  waitingFor?: string;
}

export interface AppSettings {
  autoDeleteHours: number;
  locationShortcuts: string[];
  noteShortcuts: string[];
  compactMode: boolean;
  appearanceMode: AppearanceMode;
  currentShiftStartedAt?: string;
  statusPhraseShortcuts: string[];
  hapticsEnabled: boolean;
}

export const DEFAULT_AUTO_DELETE_HOURS = 24;
export const DEFAULT_COMPACT_MODE = false;
export const DEFAULT_APPEARANCE_MODE: AppearanceMode = 'system';
export const DEFAULT_LOCATION_SHORTCUTS = ['TCI'];
export const DEFAULT_NOTE_SHORTCUTS = ['M', 'F', 'Hb', 'WCC', 'CRP', 'Na', 'K', 'Cr', 'eGFR', 'INR', 'lactate', 'abdo pain'];
export const DEFAULT_STATUS_PHRASE_SHORTCUTS = ['awaiting bloods', 'awaiting CT', 'awaiting reg review', 'family updated', 'discharge letter pending', 'meds prescribed', 'cannula done', 'fluids up'];
export const MAX_STATUS_PHRASE_SHORTCUTS = 24;
export const MAX_RADIAL_NOTE_SHORTCUTS = 8;
export const MAX_NOTE_SHORTCUTS = 24;
export const URGENCIES: Urgency[] = ['urgent', 'soon', 'routine'];
export const STATUSES: JobStatus[] = ['pending', 'seen', 'waiting', 'done'];
export const JOB_TYPES: JobType[] = ['review', 'bloods', 'imaging', 'call', 'family', 'discharge', 'prescribing', 'handover'];
export const APPEARANCE_MODES: AppearanceMode[] = ['system', 'light', 'dark'];
export const SORT_PRESETS: SortPreset[] = ['pinnedFirst', 'waitingLongest', 'recentlyTouched', 'byLocation', 'byStatus', 'byTag'];
