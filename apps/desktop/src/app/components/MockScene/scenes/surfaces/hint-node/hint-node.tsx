import type { ComponentType } from 'react';
import { HintNodeScene } from './HintNodeScene';

export const U32_HINT_NODE_SCENES = {
  'u32-hint-node': HintNodeScene,
} satisfies Readonly<Record<string, ComponentType>>;
