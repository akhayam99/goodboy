import type { ComponentType } from 'react';
import { DeskGridScene } from './DeskGridScene';

export const U50_DESK_GRID_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-desk-grid': () => <DeskGridScene tools="all" />,
  'u50-desk-grid-merged': () => <DeskGridScene tools="merged" />,
  'u50-desk-grid-terminal': () => <DeskGridScene tools="terminal" />,
  'u50-desk-grid-narrow': () => <DeskGridScene tools="all" width={1100} isBusy />,
};
