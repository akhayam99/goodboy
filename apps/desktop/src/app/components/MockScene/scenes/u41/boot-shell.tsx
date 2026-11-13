import type { ComponentType } from 'react';
import { BoardShellScene } from '../BoardShellScene';
import { showSessionOpen } from './showSessionOpen';
import { showWorkspacesKnown } from './showWorkspacesKnown';

export const U41_BOOT_SHELL_SCENES: Readonly<Record<string, ComponentType>> = {
  'boot-shell': () => <BoardShellScene afterSeed={showWorkspacesKnown} />,
  'boot-shell-sessions': () => <BoardShellScene />,
  'boot-shell-session': () => <BoardShellScene afterSeed={showSessionOpen} isSessionOpen />,
};
