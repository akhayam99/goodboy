import type { ComponentType } from 'react';
import { E2WorkingNowScene } from './E2WorkingNowScene';

export const U29_E2_WORKING_NOW_SCENES = {
  'e2-working-now-one': () => <E2WorkingNowScene hasTwoChildren={false} />,
  'e2-working-now-two': () => <E2WorkingNowScene hasTwoChildren />,
} satisfies Readonly<Record<string, ComponentType>>;
