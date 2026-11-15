import type { ComponentType } from 'react';
import { SidebarFrameScene } from './SidebarFrameScene';

export const U42_SIDEBAR_FRAME_SCENES: Readonly<Record<string, ComponentType>> = {
  'sidebar-frame-dark': () => <SidebarFrameScene theme="dark" />,
  'sidebar-frame-light': () => <SidebarFrameScene theme="light" />,
};
