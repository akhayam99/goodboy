import type { RunTreeModel } from './useRunTree';

type Params = {
  readonly items: RunTreeModel['stream']['items'];
};

type JoinParams = {
  readonly labels: ReadonlyArray<string>;
};

const joinLabels = ({ labels }: JoinParams): string => {
  if (labels.length === 1) {
    return `step ${labels[0]}`;
  }
  return `steps ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

export const withoutStepsOf = ({ items }: Params): ReadonlyMap<string, string> => {
  const without = new Map<string, string>();
  const labels: string[] = [];
  for (const item of items) {
    if (
      item.kind !== 'row' ||
      item.entry.kind !== 'agent' ||
      item.entry.agent.parentAgentId != null
    ) {
      continue;
    }
    const label = item.entry.stepLabel;
    if (item.rowState.reason?.kind === 'notFinished' && label != null) {
      labels.push(label);
      continue;
    }
    if (item.rowState.phase === 'done' && labels.length > 0) {
      without.set(item.entry.agent.id, joinLabels({ labels }));
    }
  }
  return without;
};
