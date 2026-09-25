import type { SessionExternalTask } from '@goodboy/types';

export type SummaryActionable = {
  readonly kind: 'questions' | 'drafts';
  readonly count: number;
};

export type SummaryMetaItem =
  | { readonly kind: 'actionable'; readonly actionable: SummaryActionable }
  | { readonly kind: 'task'; readonly task: SessionExternalTask; readonly more: number }
  | { readonly kind: 'agents'; readonly count: number };

type Params = {
  readonly actionable: SummaryActionable | null;
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly agentCount: number;
};

const MAX_META = 2;

export const summaryMeta = ({ actionable, tasks, agentCount }: Params) => {
  const [firstTask] = tasks;
  const items: ReadonlyArray<SummaryMetaItem | null> = [
    actionable === null ? null : { kind: 'actionable', actionable },
    firstTask === undefined ? null : { kind: 'task', task: firstTask, more: tasks.length - 1 },
    agentCount > 0 ? { kind: 'agents', count: agentCount } : null,
  ];
  return items.filter((item): item is SummaryMetaItem => item !== null).slice(0, MAX_META);
};
