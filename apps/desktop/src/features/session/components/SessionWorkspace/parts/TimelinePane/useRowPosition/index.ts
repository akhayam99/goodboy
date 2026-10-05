import { useAppStore } from '../../../../../../../store';
import type { TimelineAgentEntry } from '../../../../../timeline/buildTimelineGroups';

type Params = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
};

export const useRowPosition = ({ entry, ordinal }: Params): string => {
  const { agent } = entry;
  const total = useAppStore((state) => {
    const runId = agent.workflowRunId;
    if (runId == null) {
      return 0;
    }
    let count = 0;
    for (const candidate of state.sessionPhaseRuns[agent.sessionId] ?? []) {
      if (
        candidate.workflowRunId === runId &&
        candidate.parentAgentId == null &&
        candidate.stepId != null
      ) {
        count += 1;
      }
    }
    return count;
  });
  const label = ordinal ?? entry.stepLabel;
  if (agent.parentAgentId != null) {
    if (label === null) {
      return 'Subagent';
    }
    return `Subagent ${label} of step ${label.split('.')[0]}`;
  }
  if (agent.stepId != null && agent.workflowRunId != null) {
    if (label === null) {
      return 'Step';
    }
    return total > 0 ? `Step ${label} of ${total}` : `Step ${label}`;
  }
  return 'Launch';
};
