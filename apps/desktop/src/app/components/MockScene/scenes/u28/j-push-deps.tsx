import type { ComponentType } from 'react';
import { PushDepsScene } from './PushDepsScene';

export const U28_J_PUSH_DEPS_SCENES: Readonly<Record<string, ComponentType>> = {
  'push-fix-working': () => <PushDepsScene variant="working" />,
  'push-fix-pushed': () => <PushDepsScene variant="pushed" />,
  'push-fix-agent-failed': () => <PushDepsScene variant="agent-failed" />,
  'push-fix-push-failed': () => <PushDepsScene variant="push-failed" />,
  'push-stale-deps-linked': () => <PushDepsScene variant="deps-linked" />,
  'push-stale-deps-installing': () => <PushDepsScene variant="deps-installing" />,
};
