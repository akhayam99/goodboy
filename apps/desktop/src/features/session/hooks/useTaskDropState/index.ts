import { useSyncExternalStore } from 'react';
import type { ProjectId } from '@goodboy/types';
import { taskDragStore } from '../taskDragStore';
import { taskDropTargetKey } from '../taskDropTargetKey';

type Params = {
  readonly target: 'session' | { readonly projectId: ProjectId; readonly branch: string };
};

export type TaskDropState = 'idle' | 'ready' | 'over' | 'refused' | 'dim';

const readState = ({ target }: Params): TaskDropState => {
  const view = taskDragStore.getState().view;
  if (view === null) {
    return 'idle';
  }
  const key =
    target === 'session' ? 'session' : taskDropTargetKey({ to: { kind: 'branch', ...target } });
  if (view.targetKey === key) {
    return view.intent?.kind === 'refused' ? 'refused' : 'over';
  }
  if (
    target !== 'session' &&
    view.task.projectId != null &&
    view.task.projectId !== target.projectId
  ) {
    return 'dim';
  }
  return 'ready';
};

export const useTaskDropState = (params: Params): TaskDropState =>
  useSyncExternalStore(
    taskDragStore.subscribe,
    () => readState(params),
    () => 'idle',
  );
