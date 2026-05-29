import { ClinicalJob, JobFilter, SortPreset } from '../types/job';

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

const time = (iso: string) => {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
};

const locationLabel = (job: ClinicalJob) => job.location?.trim() || 'No location';
const tagLabel = (job: ClinicalJob) => job.jobType ?? 'untagged';

export type LocationJobGroup = { location: string; jobs: ClinicalJob[] };

export const sortJobs = (jobs: ClinicalJob[], preset: SortPreset = 'pinnedFirst'): ClinicalJob[] =>
  [...jobs].sort((a, b) => {
    if (preset === 'waitingLongest') {
      const waitingDelta = Number(b.status === 'waiting') - Number(a.status === 'waiting');
      if (waitingDelta !== 0) return waitingDelta;
      if (a.status === 'waiting' && b.status === 'waiting') return time(a.updatedAt) - time(b.updatedAt);
    }
    if (preset === 'recentlyTouched') return time(b.updatedAt) - time(a.updatedAt);
    if (preset === 'byLocation') {
      const locationDelta = locationLabel(a).localeCompare(locationLabel(b));
      if (locationDelta !== 0) return locationDelta;
    }
    if (preset === 'byStatus') {
      const statusDelta = statusRank[a.status] - statusRank[b.status];
      if (statusDelta !== 0) return statusDelta;
    }
    if (preset === 'byTag') {
      const tagDelta = tagLabel(a).localeCompare(tagLabel(b));
      if (tagDelta !== 0) return tagDelta;
    }

    const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinnedDelta !== 0) return pinnedDelta;
    const urgencyDelta = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;
    const statusDelta = statusRank[a.status] - statusRank[b.status];
    if (statusDelta !== 0) return statusDelta;
    return time(b.updatedAt) - time(a.updatedAt);
  });

export const groupJobsByLocation = (jobs: ClinicalJob[]): LocationJobGroup[] => {
  const groups = new Map<string, ClinicalJob[]>();
  for (const job of jobs) {
    const key = locationLabel(job);
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return Array.from(groups.entries()).map(([location, groupJobs]) => ({ location, jobs: groupJobs }));
};

export const filterJobs = (jobs: ClinicalJob[], filter: JobFilter): ClinicalJob[] => {
  if (filter === 'all') return jobs;
  return jobs.filter((job) => job.status === filter);
};
