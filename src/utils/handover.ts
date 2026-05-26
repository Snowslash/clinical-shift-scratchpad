import { ClinicalJob, JobStatus, Urgency } from '../types/job';
import { sortJobs } from './jobSorting';

const urgencyLabels: Record<Urgency, string> = {
  urgent: 'URGENT',
  soon: 'SOON',
  routine: 'ROUTINE',
};

const statusLabels: Record<JobStatus, string> = {
  pending: 'Pending',
  seen: 'Seen',
  waiting: 'Waiting',
  done: 'Done',
};

const formatJobLine = (job: ClinicalJob): string => {
  const bits = [job.location, job.patientIdentifier].filter(Boolean).join(' · ');
  const prefix = bits ? `${bits}: ` : '';
  return `- [${statusLabels[job.status]}] ${prefix}${job.taskText}`;
};

export const buildHandoverText = (jobs: ClinicalJob[]): string => {
  const active = sortJobs(jobs);
  if (active.length === 0) return 'No active scratchpad jobs.';

  const sections: string[] = [];
  (['urgent', 'soon', 'routine'] as Urgency[]).forEach((urgency) => {
    const byUrgency = active.filter((job) => job.urgency === urgency);
    if (byUrgency.length === 0) return;
    sections.push(`${urgencyLabels[urgency]}\n${byUrgency.map(formatJobLine).join('\n')}`);
  });

  return sections.join('\n\n');
};
