import type { ComponentType } from 'react';
import { DeskOwnsScene } from './DeskOwnsScene';

export const U50_DESK_OWNS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-desk-owns-asleep-light': () => <DeskOwnsScene theme="light" tabState="closed" />,
  'u50-desk-owns-asleep-dark': () => <DeskOwnsScene theme="dark" tabState="closed" />,
  'u50-desk-owns-awake-light': () => <DeskOwnsScene theme="light" tabState="asleep" />,
  'u50-desk-owns-awake-dark': () => <DeskOwnsScene theme="dark" tabState="asleep" />,
};
