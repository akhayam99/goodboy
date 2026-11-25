import type { SessionExternalTask } from '@goodboy/types';
import type { TasksFields, TaskRow } from '../contract/projections';
import type { TaskProvider } from '../contract/vocabulary';
import type { WorkspaceScope } from './workspaceScope';

export const TASK_LIMIT = 40;

type Params = {
  readonly scope: WorkspaceScope;
};

const PROVIDERS: ReadonlyArray<TaskProvider> = ['linear', 'sentry', 'gitlab', 'jira'];

type ProviderParams = {
  readonly provider: string;
};

const taskProviderOf = ({ provider }: ProviderParams): TaskProvider | null =>
  PROVIDERS.find((candidate) => candidate === provider) ?? null;

type RowParams = {
  readonly task: SessionExternalTask;
};

const taskRowOf = ({ task }: RowParams): TaskRow | null => {
  const provider = taskProviderOf({ provider: task.provider });
  if (provider === null) {
    return null;
  }
  return {
    id: `${task.provider}:${task.externalId}`,
    provider,
    key: task.identifier,
    title: task.title,
    words: 'In a session',
    sessionId: task.sessionId,
    canStart: false,
  };
};

export const tasksFieldsOf = ({ scope }: Params): TasksFields => {
  const rows = Object.values(scope.tasks)
    .flat()
    .flatMap((task) => {
      const row = taskRowOf({ task });
      return row === null ? [] : [row];
    });
  return {
    workspaceId: scope.workspace.id,
    count: rows.length,
    rows: rows.slice(0, TASK_LIMIT),
    start: null,
  };
};
