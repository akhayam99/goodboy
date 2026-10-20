import type { ComponentType } from 'react';
import { CentralNextScene } from './CentralNextScene';

const NARROW_COLUMN_WIDTH = 520;

export const U26_CENTRAL_NEXT_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-central-next-mid-light': () => <CentralNextScene theme="light" moment="mid" />,
  'u26-central-next-mid-dark': () => <CentralNextScene theme="dark" moment="mid" />,
  'u26-central-next-stuck-light': () => <CentralNextScene theme="light" moment="stuck" />,
  'u26-central-next-stuck-dark': () => <CentralNextScene theme="dark" moment="stuck" />,
  'u26-central-next-done-light': () => <CentralNextScene theme="light" moment="done" />,
  'u26-central-next-done-dark': () => <CentralNextScene theme="dark" moment="done" />,
  'u26-central-next-narrow-light': () => (
    <CentralNextScene theme="light" moment="mid" width={NARROW_COLUMN_WIDTH} />
  ),
};
