import type { ComponentType } from 'react';
import { AutoPushScene } from './AutoPushScene';

export const AUTO_PUSH_SCENES = {
  'auto-push-ask': () => <AutoPushScene variant="ask" />,
  'auto-push-results': () => <AutoPushScene variant="results" />,
} satisfies Readonly<Record<string, ComponentType>>;
