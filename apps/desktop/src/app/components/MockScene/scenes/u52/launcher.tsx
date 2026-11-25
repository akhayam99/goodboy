import type { ComponentType } from 'react';
import { LauncherScene } from './LauncherScene';

export const U52_LAUNCHER_SCENES: Readonly<Record<string, ComponentType>> = {
  'u52-launcher-new-dark': () => <LauncherScene theme="dark" screen="new" isChangeOpen={false} />,
  'u52-launcher-new-light': () => <LauncherScene theme="light" screen="new" isChangeOpen={false} />,
  'u52-launcher-run-dark': () => <LauncherScene theme="dark" screen="run" isChangeOpen={false} />,
  'u52-launcher-run-light': () => <LauncherScene theme="light" screen="run" isChangeOpen={false} />,
  'u52-launcher-change-dark': () => <LauncherScene theme="dark" screen="run" isChangeOpen />,
  'u52-launcher-change-light': () => <LauncherScene theme="light" screen="run" isChangeOpen />,
};
