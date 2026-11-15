import type { ComponentType } from 'react';
import { P10RightDockScene } from '../u39/P10RightDockScene';

export const U42_PANEL_FRAME_SCENES: Readonly<Record<string, ComponentType>> = {
  'panel-frame-browser': () => (
    <P10RightDockScene context="session" view="session" held="browser" />
  ),
  'panel-frame-terminal': () => (
    <P10RightDockScene context="session" view="session" held="terminal" />
  ),
  'panel-frame-detail': () => (
    <P10RightDockScene context="session" view="session" held={null} hasDetail />
  ),
  'panel-frame-detail-terminal': () => (
    <P10RightDockScene context="session" view="session" held="terminal" hasDetail />
  ),
};
