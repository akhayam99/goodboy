import type { ComponentType } from 'react';
import { BlockedMountStepScene } from './BlockedMountStepScene';
import { BlockedMountStepShotScene } from './BlockedMountStepShotScene';

export const U30_BLOCKED_MOUNT_STEP_SCENES = {
  'u30-blocked-mount-step': BlockedMountStepScene,
  'u30-blocked-mount-step-shot': BlockedMountStepShotScene,
} satisfies Readonly<Record<string, ComponentType>>;
