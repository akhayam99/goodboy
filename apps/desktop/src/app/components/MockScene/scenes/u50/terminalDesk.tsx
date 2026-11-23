import type { ComponentType } from 'react';
import { TerminalDeskScene } from './TerminalDeskScene';

export const U50_TERMINAL_DESK_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-terminal-desk-peek-light': () => <TerminalDeskScene theme="light" face="overview" />,
  'u50-terminal-desk-peek-dark': () => <TerminalDeskScene theme="dark" face="overview" />,
  'u50-terminal-desk-light': () => <TerminalDeskScene theme="light" face="desk" />,
  'u50-terminal-desk-dark': () => <TerminalDeskScene theme="dark" face="desk" />,
};
