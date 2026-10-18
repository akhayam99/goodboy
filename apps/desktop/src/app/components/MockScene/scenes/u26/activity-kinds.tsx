import type { ComponentType } from 'react';
import { ActivityKindsScene } from './ActivityKindsScene';

export const U26_ACTIVITY_KINDS_SCENES: Readonly<Record<string, ComponentType>> = {
  'activity-kinds-light': () => <ActivityKindsScene theme="light" />,
  'activity-kinds-dark': () => <ActivityKindsScene theme="dark" />,
};
