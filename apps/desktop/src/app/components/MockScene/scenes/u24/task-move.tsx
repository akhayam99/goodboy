import type { ComponentType } from 'react';
import { TaskMoveIssueScene } from './TaskMoveIssueScene';
import { TaskMoveMenuScene } from './TaskMoveMenuScene';

export const U24_TASK_MOVE_SCENES: Readonly<Record<string, ComponentType>> = {
  'taskmove-menu': TaskMoveMenuScene,
  'taskmove-issuepage': TaskMoveIssueScene,
};
