import type { TimelineRunEntry } from './buildTimelineGroups';

type Params = {
  readonly entry: TimelineRunEntry;
};

export const runStepProgress = ({ entry }: Params): string | null => {
  const started = entry.children.filter(
    (child) => child.kind === 'agent' && child.agent.status !== 'pending',
  ).length;
  const total =
    entry.run.executionMode === 'dynamic'
      ? null
      : entry.workflow.steps.filter((step) => step.deletedAt == null).length;
  if (total === 0) {
    return null;
  }
  if (started === 0) {
    if (total == null) {
      return null;
    }
    return total === 1 ? '1 step' : `${total} steps`;
  }
  if (total == null) {
    return `Step ${started}`;
  }
  return `Step ${Math.min(started, total)} of ${total}`;
};
