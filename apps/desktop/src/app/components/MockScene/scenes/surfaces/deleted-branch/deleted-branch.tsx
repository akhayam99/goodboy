import type { ComponentType } from 'react';
import { DeletedBranchScene } from './DeletedBranchScene';

export const DELETED_BRANCH_SCENES = {
  'deleted-branch-merged-light': () => <DeletedBranchScene theme="light" />,
  'deleted-branch-merged-dark': () => <DeletedBranchScene theme="dark" />,
} satisfies Readonly<Record<string, ComponentType>>;
