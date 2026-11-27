import type { ComponentType } from 'react';
import { BranchRowsScene } from './BranchRowsScene';

export const U50_BRANCH_ROWS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-branch-rows-light': () => <BranchRowsScene theme="light" />,
  'u50-branch-rows-dark': () => <BranchRowsScene theme="dark" />,
};
