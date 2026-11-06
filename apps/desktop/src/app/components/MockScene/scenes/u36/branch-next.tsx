import type { ComponentType } from 'react';
import { BranchMergedScene } from './BranchMergedScene';
import { BranchNextScene } from './BranchNextScene';

export const U36_BRANCH_NEXT_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-p16-fix-checks': () => <BranchNextScene phase="failing" />,
  'u36-p16-checks-working': () => <BranchNextScene phase="running" />,
  'u36-p16-start-fix': () => <BranchNextScene phase="proposal" />,
  'u36-p16-merged-remove': () => <BranchMergedScene />,
};
