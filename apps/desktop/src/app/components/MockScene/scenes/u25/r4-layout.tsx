import type { ComponentType } from 'react';
import { R4LayoutFrameScene } from './R4LayoutFrameScene';
import { R4LayoutLoadingScene } from './R4LayoutLoadingScene';

export const U25_R4_LAYOUT_SCENES: Readonly<Record<string, ComponentType>> = {
  'r4-layout-sessions': () => <R4LayoutFrameScene view="board" context="board" />,
  'r4-layout-tasks': () => <R4LayoutFrameScene view="inbox" context="board" />,
  'r4-layout-chat': () => <R4LayoutFrameScene view="chat" context="board" />,
  'r4-layout-workflows': () => <R4LayoutFrameScene view="workflows" context="board" />,
  'r4-layout-terminal': () => <R4LayoutFrameScene view="terminal" context="board" />,
  'r4-layout-monitoring': () => <R4LayoutFrameScene view="monitoring" context="board" />,
  'r4-layout-settings': () => <R4LayoutFrameScene view="settings" context="board" />,
  'r4-layout-guide': () => <R4LayoutFrameScene view="guide" context="board" />,
  'r4-layout-session': () => <R4LayoutFrameScene view="board" context="session" />,
  'r4-layout-loading-workflows': () => <R4LayoutLoadingScene kind="workflow" />,
  'r4-layout-loading-chat': () => <R4LayoutLoadingScene kind="chat" />,
  'r4-layout-loading-terminal': () => <R4LayoutLoadingScene kind="terminal" />,
  'r4-layout-loading-tasks': () => <R4LayoutLoadingScene kind="inbox" />,
};
