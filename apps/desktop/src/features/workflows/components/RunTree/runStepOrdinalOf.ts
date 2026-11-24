import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';

type Params = {
  readonly entry: TimelineAgentEntry;
  readonly isNested: boolean;
  readonly isChecklist: boolean;
};

export const runStepOrdinalOf = ({ entry, isNested, isChecklist }: Params): string => {
  if (entry.stepLabel == null) {
    return '';
  }
  return isChecklist && !isNested ? `Step ${entry.stepLabel}` : entry.stepLabel;
};
