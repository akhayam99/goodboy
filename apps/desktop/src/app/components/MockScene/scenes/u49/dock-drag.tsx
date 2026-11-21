import type { ComponentType } from 'react';
import { DockPanelsScene } from './DockPanelsScene';

export const U49_DOCK_DRAG_SCENES: Readonly<Record<string, ComponentType>> = {
  'dock-pair': () => <DockPanelsScene shape="pair" />,
  'dock-stack': () => <DockPanelsScene shape="stack" />,
  'dock-three': () => <DockPanelsScene shape="three" />,
};
