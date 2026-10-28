import type { ComponentType } from 'react';
import { BResolveStateScene } from './BResolveStateScene';

export const U28_B_RESOLVE_STATE_SCENES: Readonly<Record<string, ComponentType>> = {
  'resolve-state-working': () => <BResolveStateScene variant="working" />,
  'resolve-state-ready': () => <BResolveStateScene variant="ready" />,
  'resolve-state-skipped': () => <BResolveStateScene variant="skipped" />,
  'resolve-state-failed': () => <BResolveStateScene variant="failed" />,
};
