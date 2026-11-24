import type { ComponentType } from 'react';
import { NarrowHeadsScene } from './NarrowHeadsScene';

export const NARROW_HEADS_SCENES: Readonly<Record<string, ComponentType>> = {
  'tool-heads-narrow': () => <NarrowHeadsScene theme="light" />,
  'tool-heads-narrow-dark': () => <NarrowHeadsScene theme="dark" />,
};
