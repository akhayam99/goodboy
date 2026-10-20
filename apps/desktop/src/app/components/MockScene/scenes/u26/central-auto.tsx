import type { ComponentType } from 'react';
import { AutoCentralScene } from './AutoCentralScene';

export const U26_CENTRAL_AUTO_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-central-auto-done-dark': () => <AutoCentralScene theme="dark" variant="done" />,
  'u26-central-auto-done-light': () => <AutoCentralScene theme="light" variant="done" />,
  'u26-central-auto-failed-dark': () => <AutoCentralScene theme="dark" variant="failed" />,
  'u26-central-auto-failed-light': () => <AutoCentralScene theme="light" variant="failed" />,
  'u26-central-auto-stuck-dark': () => <AutoCentralScene theme="dark" variant="stuck" />,
  'u26-central-auto-stuck-light': () => <AutoCentralScene theme="light" variant="stuck" />,
  'u26-central-auto-working-dark': () => <AutoCentralScene theme="dark" variant="working" />,
  'u26-central-auto-working-light': () => <AutoCentralScene theme="light" variant="working" />,
};
