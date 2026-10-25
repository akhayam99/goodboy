import type { ComponentType } from 'react';
import { BellOpenedScene } from './BellOpenedScene';
import { BellOverflowScene } from './BellOverflowScene';

export const U28_BELL_OVERFLOW_SCENES: Readonly<Record<string, ComponentType>> = {
  'u28-bell-overflow': BellOverflowScene,
  'u28-bell-opened': BellOpenedScene,
};
