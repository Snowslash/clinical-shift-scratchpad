import { describe, expect, it } from 'vitest';
import { ClinicalJob } from '../types/job';
import { filterJobs, sortJobs } from './jobSorting';

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
  it('sorts by urgency, then status, then oldest first', () => {
    const jobs: ClinicalJob[] = [
      { ...baseJob, id: 'routine-old', urgency: 'routine', createdAt: '2026-05-25T08:00:00.000Z' },
      { ...baseJob, id: 'urgent-done', urgency: 'urgent', status: 'done', createdAt: '2026-05-25T07:00:00.000Z' },
      { ...baseJob, id: 'urgent-pending-new', urgency: 'urgent', status: 'pending', createdAt: '2026-05-25T09:00:00.000Z' },
      { ...baseJob, id: 'urgent-pending-old', urgency: 'urgent', status: 'pending', createdAt: '2026-05-25T06:00:00.000Z' },
      { ...baseJob, id: 'soon', urgency: 'soon' },
    ];

    expect(sortJobs(jobs).map((item) => item.id)).toEqual([
      'urgent-pending-old',
      'urgent-pending-new',
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
});
