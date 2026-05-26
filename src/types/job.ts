export type Urgency = 'routine' | 'soon' | 'urgent';
export type JobStatus = 'pending' | 'seen' | 'waiting' | 'done';
export type JobFilter = 'all' | JobStatus;

export interface ClinicalJob {
  id: string;
  patientIdentifier?: string;
  location?: string;
  taskText: string;
  urgency: Urgency;
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
}

export interface AppSettings {
  autoDeleteHours: number;
  locationShortcuts: string[];
}

export const DEFAULT_AUTO_DELETE_HOURS = 24;
export const DEFAULT_LOCATION_SHORTCUTS = ['TCI'];
export const URGENCIES: Urgency[] = ['urgent', 'soon', 'routine'];
export const STATUSES: JobStatus[] = ['pending', 'seen', 'waiting', 'done'];
