import type { ComponentType } from 'react';
import { BoardShellScene } from '../../BoardShellScene';
import { openScriptsWithNoSession } from './openScriptsWithNoSession';

export const WINDOW_DOCK_SCENES = {
  'window-dock-board-scripts': () => <BoardShellScene afterSeed={openScriptsWithNoSession} />,
} satisfies Readonly<Record<string, ComponentType>>;
