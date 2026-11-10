import type { ComponentType } from 'react';
import { P10RightDockScene } from './P10RightDockScene';

export const U39_P10_SCENES = {
  'ux39-p10-board': () => <P10RightDockScene context="board" view="board" held={null} />,
  'ux39-p10-session': () => <P10RightDockScene context="session" view="session" held={null} />,
  'ux39-p10-tasks': () => <P10RightDockScene context="board" view="inbox" held={null} />,
  'ux39-p11-terminal-board': () => (
    <P10RightDockScene context="board" view="board" held="terminal" />
  ),
  'ux39-p11-terminal-session': () => (
    <P10RightDockScene context="session" view="session" held="terminal" />
  ),
  'ux39-p11-terminal-page': () => <P10RightDockScene context="board" view="terminal" held={null} />,
  'ux39-p11-browser-session': () => (
    <P10RightDockScene context="session" view="session" held="browser" />
  ),
  'ux39-p11-browser-page': () => <P10RightDockScene context="session" view="browser" held={null} />,
  'ux39-p12-tasks-terminal': () => (
    <P10RightDockScene context="board" view="inbox" held="terminal" />
  ),
  'ux39-p4-column-folded': () => (
    <P10RightDockScene context="board" view="board" held={null} isRailCollapsed />
  ),
} satisfies Readonly<Record<string, ComponentType>>;
