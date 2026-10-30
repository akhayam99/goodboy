import type { ComponentType } from 'react';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import type { C07Seed } from '../u25/c07/c07AutoSeed';

const WORKING: C07Seed = { state: 'working', place: 'auto' };

export const U30_MODEL_LINES_SCENES = {
  'u30-model-lines': () => <C07AutoFrame seed={WORKING} />,
} satisfies Readonly<Record<string, ComponentType>>;
