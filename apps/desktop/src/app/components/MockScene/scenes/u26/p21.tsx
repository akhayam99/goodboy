import type { ComponentType } from 'react';
import { P21DrawerComposerScene } from './P21DrawerComposerScene';

export const U26_P21_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-p21-drawer-composer-light': () => <P21DrawerComposerScene theme="light" />,
  'u26-p21-drawer-composer-dark': () => <P21DrawerComposerScene theme="dark" />,
};
