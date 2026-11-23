import type { ComponentType } from 'react';
import { WorktreesScene } from './WorktreesScene';

export const U50_WORKTREES_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-worktrees-light': () => <WorktreesScene theme="light" isOpen={false} />,
  'u50-worktrees-dark': () => <WorktreesScene theme="dark" isOpen={false} />,
  'u50-worktrees-sheet-light': () => <WorktreesScene theme="light" isOpen />,
  'u50-worktrees-sheet-dark': () => <WorktreesScene theme="dark" isOpen />,
};
