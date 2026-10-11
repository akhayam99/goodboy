import type { ProjectId } from '@goodboy/types';
import type { TaskMoveTarget } from '../../../store/slices/sessions/moveSessionExternalTask';

type Params = {
  readonly to: TaskMoveTarget;
};

type ReadParams = {
  readonly element: Element | null;
  readonly projectIds: ReadonlyArray<ProjectId>;
};

export const taskDropTargetKey = ({ to }: Params): string | null => {
  if (to.kind === 'session') {
    return 'session';
  }
  if (to.kind === 'branch') {
    return `branch:${to.projectId ?? ''}:${to.branch}`;
  }
  return null;
};

export const readTaskDropTarget = ({ element, projectIds }: ReadParams): TaskMoveTarget | null => {
  const node = element?.closest<HTMLElement>('[data-task-drop]') ?? null;
  if (node === null) {
    return null;
  }
  if (node.dataset.taskDrop === 'session') {
    return { kind: 'session' };
  }
  const branch = node.dataset.taskBranch ?? '';
  if (node.dataset.taskDrop !== 'branch' || branch === '') {
    return null;
  }
  const projectId = node.dataset.taskProject ?? '';
  return {
    kind: 'branch',
    projectId: projectIds.find((id) => id === projectId) ?? null,
    branch,
  };
};
