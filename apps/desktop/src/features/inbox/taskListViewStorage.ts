import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../shared/lib/storage-keys';
import { TASK_GROUP_BYS, type TaskGroupBy } from './taskGroups';

export type TaskScope = 'for-me' | 'all';

export type TaskListView = {
  readonly scope: TaskScope;
  readonly groupBy: TaskGroupBy;
};

const DEFAULT_TASK_LIST_VIEW: TaskListView = { scope: 'for-me', groupBy: 'source' };

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = Params & {
  readonly view: TaskListView;
};

const isTaskScope = (value: unknown): value is TaskScope => value === 'for-me' || value === 'all';

const isTaskGroupBy = (value: unknown): value is TaskGroupBy =>
  typeof value === 'string' && TASK_GROUP_BYS.some((candidate) => candidate === value);

const taskListViewPref = ({ workspaceId }: Params) =>
  persistedPref<TaskListView>({
    key: `${STORAGE_PREFIXES.taskListView}${workspaceId}`,
    fallback: DEFAULT_TASK_LIST_VIEW,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return undefined;
      }
      const scope: unknown = Reflect.get(parsed, 'scope');
      const groupBy: unknown = Reflect.get(parsed, 'groupBy');
      if (!isTaskScope(scope) || !isTaskGroupBy(groupBy)) {
        return undefined;
      }
      return { scope, groupBy };
    },
  });

export const readTaskListView = ({ workspaceId }: Params): TaskListView =>
  taskListViewPref({ workspaceId }).read();

export const writeTaskListView = ({ workspaceId, view }: WriteParams): void =>
  taskListViewPref({ workspaceId }).write(view);
