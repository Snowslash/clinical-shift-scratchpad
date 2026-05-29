import { describe, expect, it } from 'vitest';
import { ClinicalJob } from '../types/job';
import { filterJobs, groupJobsByLocation, sortJobs } from './jobSorting';

const baseJob: ClinicalJob = {
  id: 'base',
  taskText: 'Task',
  urgency: 'routine',
  status: 'pending',
  createdAt: '2026-05-25T12:00:00.000Z',
  updatedAt: '2026-05-25T12:00:00.000Z',
  expiresAt: '2026-05-26T12:00:00.000Z',
};

describe('job sorting and filtering', () => {
  it('sorts pinned jobs first, then urgency, status, and recently touched first', () => {
    const jobs: ClinicalJob[] = [
      { ...baseJob, id: 'routine-old', urgency: 'routine', updatedAt: '2026-05-25T08:00:00.000Z' },
      { ...baseJob, id: 'urgent-done', urgency: 'urgent', status: 'done', updatedAt: '2026-05-25T07:00:00.000Z' },
      { ...baseJob, id: 'urgent-pending-new', urgency: 'urgent', status: 'pending', updatedAt: '2026-05-25T09:00:00.000Z' },
      { ...baseJob, id: 'urgent-pending-old', urgency: 'urgent', status: 'pending', updatedAt: '2026-05-25T06:00:00.000Z' },
      { ...baseJob, id: 'pinned-routine', urgency: 'routine', pinned: true, updatedAt: '2026-05-25T05:00:00.000Z' },
      { ...baseJob, id: 'soon', urgency: 'soon' },
    ];

    expect(sortJobs(jobs).map((item) => item.id)).toEqual([
      'pinned-routine',
      'urgent-pending-new',
      'urgent-pending-old',
      'urgent-done',
      'soon',
      'routine-old',
    ]);
  });

  it('filters by status or returns all jobs', () => {
    const pending = { ...baseJob, id: 'pending', status: 'pending' as const };
    const waiting = { ...baseJob, id: 'waiting', status: 'waiting' as const };

    expect(filterJobs([pending, waiting], 'waiting')).toEqual([waiting]);
    expect(filterJobs([pending, waiting], 'all')).toEqual([pending, waiting]);
  });

  it('supports non-clinical sort presets and location grouping', () => {
    const jobs: ClinicalJob[] = [
      { ...baseJob, id: 'old-waiting', location: 'SAU', status: 'waiting', updatedAt: '2026-05-25T08:00:00.000Z' },
      { ...baseJob, id: 'new-waiting', location: 'AMU', status: 'waiting', updatedAt: '2026-05-25T11:00:00.000Z' },
      { ...baseJob, id: 'pinned', location: 'AMU', pinned: true, updatedAt: '2026-05-25T09:00:00.000Z' },
      { ...baseJob, id: 'done', location: undefined, status: 'done', updatedAt: '2026-05-25T10:00:00.000Z' },
    ];

    expect(sortJobs(jobs, 'waitingLongest').map((item) => item.id)).toEqual(['old-waiting', 'new-waiting', 'pinned', 'done']);
    expect(sortJobs(jobs, 'recentlyTouched').map((item) => item.id)).toEqual(['new-waiting', 'done', 'pinned', 'old-waiting']);
    expect(sortJobs(jobs, 'byLocation').map((item) => item.id)).toEqual(['pinned', 'new-waiting', 'done', 'old-waiting']);
    expect(groupJobsByLocation(sortJobs(jobs, 'byLocation')).map((group) => [group.location, group.jobs.map((item) => item.id)])).toEqual([
      ['AMU', ['pinned', 'new-waiting']],
      ['No location', ['done']],
      ['SAU', ['old-waiting']],
    ]);
  });

});
