import type { ComponentType } from 'react';
import { BranchRunsLinkedScene } from './BranchRunsLinkedScene';

export const U44_BRANCH_RUNS_LINKED_SCENES = {
  'u44-branch-runs-linked': () => <BranchRunsLinkedScene />,
} satisfies Readonly<Record<string, ComponentType>>;
