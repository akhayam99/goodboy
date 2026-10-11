import type { ProjectId, SessionExternalTask } from '@goodboy/types';
import type { TaskMoveTarget } from '../../../store/slices/sessions/moveSessionExternalTask';
import type { TaskDragIntent } from './taskDragStore';

type Params = {
  readonly task: SessionExternalTask;
  readonly sourceBranch: string | null;
  readonly to: TaskMoveTarget | null;
  readonly isCopy: boolean;
  readonly nameOf: (projectId: ProjectId | null | undefined) => string | null;
};

export const taskDragIntent = ({
  task,
  sourceBranch,
  to,
  isCopy,
  nameOf,
}: Params): TaskDragIntent | null => {
  if (to === null || to.kind === 'off') {
    return null;
  }
  const verb = isCopy ? 'Copy' : 'Move';
  const kind = isCopy ? 'copy' : 'move';
  if (to.kind === 'session') {
    if (sourceBranch === null) {
      return { kind: 'same', text: 'Already here' };
    }
    return { kind, text: `${verb} to the session` };
  }
  if (task.projectId != null && to.projectId !== null && to.projectId !== task.projectId) {
    return {
      kind: 'refused',
      text: `Only ${nameOf(task.projectId) ?? 'its project'} branches`,
    };
  }
  if (to.branch === sourceBranch) {
    return { kind: 'same', text: 'Already here' };
  }
  const name = nameOf(to.projectId ?? task.projectId);
  return { kind, text: `${verb} to ${name === null ? to.branch : `${name} / ${to.branch}`}` };
};
