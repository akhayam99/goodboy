import type { ComponentType } from 'react';
import { AttnNoiseScene } from './AttnNoiseScene';

export const ATTN_NOISE_SCENES = {
  'attn-noise': () => <AttnNoiseScene />,
} satisfies Readonly<Record<string, ComponentType>>;
