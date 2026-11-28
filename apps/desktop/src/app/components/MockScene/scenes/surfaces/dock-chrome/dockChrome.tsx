import type { ComponentType } from 'react';
import { MergedScene } from './MergedScene';
import { MonitorFrameScene } from './MonitorFrameScene';

export const DOCK_CHROME_SCENES = {
  'dock-chrome-monitor': () => <MonitorFrameScene />,
  'dock-chrome-merged': () => <MergedScene />,
} satisfies Readonly<Record<string, ComponentType>>;
