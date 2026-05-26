import { describe, expect, it } from 'vitest';
import { ClinicalJob } from '../types/job';
import { buildHandoverText } from './handover';

const baseJob: ClinicalJob = {
  id: 'base',
  taskText: 'Review bloods',
  urgency: 'routine',
  status: 'pending',
  createdAt: '2026-05-25T12:00:00.000Z',
  updatedAt: '2026-05-25T12:00:00.000Z',
  expiresAt: '2026-05-26T12:00:00.000Z',
};

describe('handover text', () => {
  it('groups jobs by urgency and includes status/location/identifier/task', () => {
    const text = buildHandoverText([
      { ...baseJob, id: '1', urgency: 'routine', location: 'Ward A', patientIdentifier: 'Bed 2', taskText: 'Check K' },
      { ...baseJob, id: '2', urgency: 'urgent', status: 'waiting', location: 'ED', taskText: 'Review pain' },
    ]);

    expect(text).toContain('URGENT\n- [Waiting] ED: Review pain');
    expect(text).toContain('ROUTINE\n- [Pending] Ward A · Bed 2: Check K');
  });

  it('returns an empty-state line when there are no active jobs', () => {
    expect(buildHandoverText([])).toBe('No active scratchpad jobs.');
  });
});
