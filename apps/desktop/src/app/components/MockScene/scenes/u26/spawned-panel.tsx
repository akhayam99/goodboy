import type { ComponentType } from 'react';
import { SpawnedPanelScene } from './SpawnedPanelScene';

export const U26_SPAWNED_PANEL_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-spawned-auto-light': () => <SpawnedPanelScene theme="light" view="auto" />,
  'u26-spawned-auto-dark': () => <SpawnedPanelScene theme="dark" view="auto" />,
  'u26-spawned-run-light': () => <SpawnedPanelScene theme="light" view="run" />,
  'u26-spawned-run-dark': () => <SpawnedPanelScene theme="dark" view="run" />,
  'u26-spawned-transcript-light': () => <SpawnedPanelScene theme="light" view="transcript" />,
  'u26-spawned-transcript-dark': () => <SpawnedPanelScene theme="dark" view="transcript" />,
};
