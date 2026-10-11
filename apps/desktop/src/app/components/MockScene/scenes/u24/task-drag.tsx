import type { ComponentType } from 'react';
import { TaskDragCopyScene } from './TaskDragCopyScene';
import { TaskDragOverBranchScene } from './TaskDragOverBranchScene';
import { TaskDragOverSessionScene } from './TaskDragOverSessionScene';
import { TaskDragRefusedScene } from './TaskDragRefusedScene';

export const U24_TASK_DRAG_SCENES: Readonly<Record<string, ComponentType>> = {
  'taskdrag-oversession': TaskDragOverSessionScene,
  'taskdrag-overbranch': TaskDragOverBranchScene,
  'taskdrag-refused': TaskDragRefusedScene,
  'taskdrag-copy': TaskDragCopyScene,
};
