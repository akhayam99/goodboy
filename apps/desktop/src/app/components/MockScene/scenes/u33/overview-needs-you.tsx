import type { ComponentType } from 'react';
import { OverviewNeedsYouScene } from './OverviewNeedsYouScene';

export const U33_OVERVIEW_NEEDS_YOU_SCENES = {
  'u33-overview-needs-you': OverviewNeedsYouScene,
} satisfies Readonly<Record<string, ComponentType>>;
