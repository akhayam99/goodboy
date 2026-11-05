import type { ComponentType } from 'react';
import { BlockedMountStepScene } from '../u30/BlockedMountStepScene';
import { seedAddProject } from './addProjectSeed';

export const U34_ADD_PROJECT_SCENES: Readonly<Record<string, ComponentType>> = {
  'u34-p26-add-project': () => <BlockedMountStepScene seed={seedAddProject} />,
};
