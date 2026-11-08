import type { ComponentType } from 'react';
import { BranchNextScene } from '../u36/BranchNextScene';
import { seedBranchWork } from './branchWorkSeed';

export const U37_BRANCH_WORK_SCENES = {
  'u37-branch-work': () => <BranchNextScene phase="running" extra={seedBranchWork} />,
} satisfies Readonly<Record<string, ComponentType>>;
