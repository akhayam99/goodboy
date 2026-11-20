import type { ProjectRelocationCandidate } from './state';

type Params = {
  readonly candidate: ProjectRelocationCandidate;
};

export const isPendingRelocation = ({ candidate }: Params): boolean =>
  candidate.isSelected && candidate.toRoot !== null && candidate.status !== 'done';
