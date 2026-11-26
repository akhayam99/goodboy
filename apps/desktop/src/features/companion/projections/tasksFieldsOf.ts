import type { SessionExternalTask } from '@goodboy/types';
import type { TasksFields, TaskRow } from '../contract/projections';
import type { TaskProvider } from '../contract/vocabulary';
import { startOfferOf } from './startOfferOf';
import type { WorkspaceScope } from './workspaceScope';

export const TASK_LIMIT = 40;

type Params = {
  readonly scope: WorkspaceScope;
  readonly now: number;
};

const PROVIDERS: ReadonlyArray<TaskProvider> = ['linear', 'sentry', 'gitlab', 'jira'];

type ProviderParams = {
  readonly provider: string;
};

const taskProviderOf = ({ provider }: ProviderParams): TaskProvider | null =>
  PROVIDERS.find((candidate) => candidate === provider) ?? null;

type RowParams = {
  readonly task: SessionExternalTask;
  readonly facts: WorkspaceScope['taskFacts'];
};

const taskRowOf = ({ task, facts }: RowParams): TaskRow | null => {
  const provider = taskProviderOf({ provider: task.provider });
  if (provider === null) {
    return null;
  }
  const fact = facts[`${task.provider}:${task.externalId}`];
  return {
    description: fact?.description ?? null,
    assignee: fact?.assignee ?? null,
    stateLabel: fact?.stateLabel ?? null,
    id: `${task.provider}:${task.externalId}`,
    provider,
    key: task.identifier,
    title: task.title,
    words: 'In a session',
    sessionId: task.sessionId,
    canStart: false,
  };
};

export const tasksFieldsOf = ({ scope, now }: Params): TasksFields => {
  const rows = Object.values(scope.tasks)
    .flat()
    .flatMap((task) => {
      const row = taskRowOf({ task, facts: scope.taskFacts });
      return row === null ? [] : [row];
    });
  return {
    workspaceId: scope.workspace.id,
    count: rows.length,
    rows: rows.slice(0, TASK_LIMIT),
    start: startOfferOf({ scope, now }),
  };
};
