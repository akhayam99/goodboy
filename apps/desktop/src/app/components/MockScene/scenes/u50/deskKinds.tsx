import type { ComponentType } from 'react';
import { DeskKindsScene } from './DeskKindsScene';

export const U50_DESK_KINDS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-desk-kinds-light': () => <DeskKindsScene theme="light" />,
  'u50-desk-kinds-dark': () => <DeskKindsScene theme="dark" />,
};
