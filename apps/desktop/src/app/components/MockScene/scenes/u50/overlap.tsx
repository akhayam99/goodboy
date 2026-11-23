import type { ComponentType } from 'react';
import { OverlapScene } from './OverlapScene';

export const U50_OVERLAP_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-overlap-light': () => <OverlapScene theme="light" view="rows" />,
  'u50-overlap-dark': () => <OverlapScene theme="dark" view="rows" />,
  'u50-overlap-open-light': () => <OverlapScene theme="light" view="open" />,
  'u50-overlap-open-dark': () => <OverlapScene theme="dark" view="open" />,
};
