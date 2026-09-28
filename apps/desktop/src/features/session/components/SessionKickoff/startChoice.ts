import type { StartChoice } from '../../../../store/slices/sessionDraft/state';

export type { StartChoice };

export const START_CHOICES: ReadonlyArray<StartChoice> = ['task', 'workflow', 'scout'];

type PreselectParams = {
  readonly hasTrackerCandidates: boolean;
};

export const preselectStartChoice = ({ hasTrackerCandidates }: PreselectParams): StartChoice =>
  hasTrackerCandidates ? 'task' : 'workflow';
