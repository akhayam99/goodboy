import type { ComponentType } from 'react';
import { IntrosScene } from './IntrosScene';

export const U26_INTROS_SCENES = {
  'u26-intros-runs': () => <IntrosScene page="runs" isEmpty={false} />,
  'u26-intros-runs-empty': () => <IntrosScene page="runs" isEmpty />,
} satisfies Readonly<Record<string, ComponentType>>;
