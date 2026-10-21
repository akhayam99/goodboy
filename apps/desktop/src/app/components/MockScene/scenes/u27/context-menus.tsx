import type { ComponentType } from 'react';
import { CentralBranchMenuScene } from './CentralBranchMenuScene';
import { LaunchRowMenuScene } from './LaunchRowMenuScene';

export const U27_CONTEXT_MENU_SCENES: Readonly<Record<string, ComponentType>> = {
  'u27-central-branch-menu': CentralBranchMenuScene,
  'u27-launch-row-menu': LaunchRowMenuScene,
};
