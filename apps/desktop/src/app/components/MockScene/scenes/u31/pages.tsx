import type { ComponentType } from 'react';
import { PagesScene } from './PagesScene';

export const U31_PAGES_SCENES = {
  'u31-overview': () => <PagesScene page="overview" />,
  'u31-runs': () => <PagesScene page="runs" />,
  'u31-runs-run': () => <PagesScene page="run" />,
} satisfies Readonly<Record<string, ComponentType>>;
