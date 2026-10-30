import type { ComponentType } from 'react';
import { PopoversStage } from './edges/PopoversStage';

export const U30_POPOVERS_SCENES = {
  'u30-popovers': PopoversStage,
} satisfies Readonly<Record<string, ComponentType>>;
