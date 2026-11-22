import type { ComponentType } from 'react';
import { OverviewScene } from './OverviewScene';

export const U50_OVERVIEW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-overview-light': () => <OverviewScene theme="light" isDevShown />,
  'u50-overview-dark': () => <OverviewScene theme="dark" isDevShown />,
  'u50-overview-plain-light': () => <OverviewScene theme="light" isDevShown={false} />,
  'u50-overview-plain-dark': () => <OverviewScene theme="dark" isDevShown={false} />,
};
