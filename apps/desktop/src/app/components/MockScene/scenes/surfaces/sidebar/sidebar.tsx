import type { ComponentType } from 'react';
import { SidebarScene } from './SidebarScene';

export const U31_SIDEBAR_SCENES = {
  'u31-sidebar': () => <SidebarScene />,
} satisfies Readonly<Record<string, ComponentType>>;
