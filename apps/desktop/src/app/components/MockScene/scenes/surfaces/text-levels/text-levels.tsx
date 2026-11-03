import type { ComponentType } from 'react';
import { TextLevelsScene } from './TextLevelsScene';

export const U31_TEXT_LEVELS_SCENES = {
  'u31-text-levels': () => <TextLevelsScene />,
} satisfies Readonly<Record<string, ComponentType>>;
