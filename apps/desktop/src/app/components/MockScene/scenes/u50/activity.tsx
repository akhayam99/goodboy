import type { ComponentType } from 'react';
import { ActivityScene } from './ActivityScene';

export const U50_ACTIVITY_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-activity-light': () => <ActivityScene theme="light" />,
  'u50-activity-dark': () => <ActivityScene theme="dark" />,
};
