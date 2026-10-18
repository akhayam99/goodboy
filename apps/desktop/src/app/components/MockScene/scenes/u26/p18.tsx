import type { ComponentType } from 'react';
import { P18DrawerScene } from './P18DrawerScene';

export const U26_P18_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-p18-drawer-light': () => <P18DrawerScene theme="light" />,
  'u26-p18-drawer-dark': () => <P18DrawerScene theme="dark" />,
};
