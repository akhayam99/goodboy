import type { ComponentType } from 'react';
import { IntrosScene } from './IntrosScene';

export const U26_INTROS_SCENES = {
  'u26-intros-runs': () => <IntrosScene page="runs" isEmpty={false} />,
  'u26-intros-runs-empty': () => <IntrosScene page="runs" isEmpty />,
  'u26-intros-orchestrated': () => <IntrosScene page="orchestrated" isEmpty={false} />,
  'u26-intros-orchestrated-empty': () => <IntrosScene page="orchestrated" isEmpty />,
  'u26-intros-agents': () => <IntrosScene page="agents" isEmpty={false} />,
  'u26-intros-agents-empty': () => <IntrosScene page="agents" isEmpty />,
  'u26-intros-auto': () => <IntrosScene page="auto" isEmpty={false} />,
  'u26-intros-auto-empty': () => <IntrosScene page="auto" isEmpty />,
} satisfies Readonly<Record<string, ComponentType>>;
