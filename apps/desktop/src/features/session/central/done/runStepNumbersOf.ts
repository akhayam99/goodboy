import type { TimelineAgentEntry, TimelineRunEntry } from '../../timeline/buildTimelineGroups';
import { runStepCounts } from '../../timeline/runStepProgress';

type Params = {
  readonly entry: TimelineRunEntry;
};

export type RunStepNumbers = {
  readonly numberOf: ReadonlyMap<string, number>;
  readonly total: number | null;
};

const stepAgentsOf = ({ entry }: Params): ReadonlyArray<TimelineAgentEntry> =>
  entry.children
    .flatMap((child) => (child.kind === 'agent' ? [child] : []))
    .filter((child) => child.agent.parentAgentId == null);

export const runStepNumbersOf = ({ entry }: Params): RunStepNumbers => {
  const numberOf = new Map<string, number>();
  const { total } = runStepCounts({ entry });
  if (entry.run.executionMode === 'dynamic') {
    [...stepAgentsOf({ entry })]
      .sort((first, second) => first.agent.ordinal - second.agent.ordinal)
      .forEach((child, index) => numberOf.set(child.agent.id, index + 1));
    return { numberOf, total };
  }
  const steps = entry.workflow.steps.filter((step) => step.deletedAt == null);
  for (const child of stepAgentsOf({ entry })) {
    const index = steps.findIndex((step) => step.id === child.agent.stepId);
    if (index >= 0) {
      numberOf.set(child.agent.id, index + 1);
    }
  }
  return { numberOf, total };
};
