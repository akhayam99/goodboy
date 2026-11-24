import type { ComponentType } from 'react';
import { OverviewScene } from './OverviewScene';

export const U50_OVERVIEW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-overview-light': () => <OverviewScene theme="light" />,
  'u50-overview-dark': () => <OverviewScene theme="dark" />,
};
