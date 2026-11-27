import type { ComponentType } from 'react';
import { BoardShellScene } from '../../BoardShellScene';
import { openTerminalWithElsewhere } from './openTerminalWithElsewhere';
import { openScriptsWithNoSession } from './openScriptsWithNoSession';

export const WINDOW_DOCK_SCENES = {
  'window-dock-board-scripts': () => <BoardShellScene afterSeed={openScriptsWithNoSession} />,
  'window-dock-board-terminal': () => <BoardShellScene afterSeed={openTerminalWithElsewhere} />,
} satisfies Readonly<Record<string, ComponentType>>;
