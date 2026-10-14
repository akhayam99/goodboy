import { AGENT_LINE, AUTO_AGENT_LINE, RUN_LINE, TASK_LINE } from '../../../../shared/lib/startCopy';
import type { StartChoice } from '../../../../store/slices/sessionDraft/state';

export type { StartChoice };

export const START_CHOICES: ReadonlyArray<StartChoice> = ['task', 'workflow', 'scout'];

type PreselectParams = {
  readonly hasTrackerCandidates: boolean;
};

export const preselectStartChoice = ({ hasTrackerCandidates }: PreselectParams): StartChoice =>
  hasTrackerCandidates ? 'task' : 'workflow';

type LineParams = {
  readonly choice: StartChoice;
  readonly isAuto: boolean;
};

export const startChoiceLine = ({ choice, isAuto }: LineParams): string => {
  if (choice === 'task') {
    return TASK_LINE;
  }
  if (choice === 'workflow') {
    return RUN_LINE;
  }
  return isAuto ? AUTO_AGENT_LINE : AGENT_LINE;
};
