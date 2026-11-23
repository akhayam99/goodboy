import type { ComponentType } from 'react';
import { DeskNavScene } from './DeskNavScene';

export const U50_DESK_NAV_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-desk-nav-closed-light': () => <DeskNavScene theme="light" line="closed" />,
  'u50-desk-nav-closed-dark': () => <DeskNavScene theme="dark" line="closed" />,
  'u50-desk-nav-elsewhere-light': () => <DeskNavScene theme="light" line="open-elsewhere" />,
  'u50-desk-nav-elsewhere-dark': () => <DeskNavScene theme="dark" line="open-elsewhere" />,
  'u50-desk-nav-moved-light': () => <DeskNavScene theme="light" line="moved" />,
  'u50-desk-nav-moved-dark': () => <DeskNavScene theme="dark" line="moved" />,
};
