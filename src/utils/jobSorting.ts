import { ClinicalJob, JobFilter } from '../types/job';

const urgencyRank: Record<ClinicalJob['urgency'], number> = {
  urgent: 0,
  soon: 1,
  routine: 2,
};

const statusRank: Record<ClinicalJob['status'], number> = {
  pending: 0,
  seen: 1,
  waiting: 2,
  done: 3,
};

export const sortJobs = (jobs: ClinicalJob[]): ClinicalJob[] =>
  [...jobs].sort((a, b) => {
    const urgencyDelta = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;
    const statusDelta = statusRank[a.status] - statusRank[b.status];
    if (statusDelta !== 0) return statusDelta;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

export const filterJobs = (jobs: ClinicalJob[], filter: JobFilter): ClinicalJob[] => {
  if (filter === 'all') return jobs;
  return jobs.filter((job) => job.status === filter);
};
