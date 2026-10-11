import { useSyncExternalStore } from 'react';
import { taskDragStore } from '../taskDragStore';
import type { TaskDragView } from '../taskDragStore';

export const useTaskDragState = (): TaskDragView | null =>
  useSyncExternalStore(
    taskDragStore.subscribe,
    () => taskDragStore.getState().view,
    () => null,
  );
