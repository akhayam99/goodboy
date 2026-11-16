import type { ComponentType } from 'react';
import { CentralColumnScene } from '../u26/CentralColumnScene';

export const U44_BRANCH_TILES_SCENES = {
  'u44-branch-tiles': () => <CentralColumnScene kind="branches" />,
} satisfies Readonly<Record<string, ComponentType>>;
