import type { ComponentType } from 'react';
import { DockDropChipsScene } from './DockDropChipsScene';

export const WINDOW_DOCK_DROPCHIPS_SCENES = {
  'dock-dropchips-merge': () => <DockDropChipsScene shape="three" aim="merge" />,
  'dock-dropchips-below': () => <DockDropChipsScene shape="stack" aim="below" />,
  'dock-dropchips-edge': () => <DockDropChipsScene shape="three" aim="dock-right" />,
} satisfies Readonly<Record<string, ComponentType>>;
