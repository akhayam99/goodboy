import type { ComponentType } from 'react';
import { AttnNoiseScene } from './AttnNoiseScene';
import { AttnNoiseSeenScene } from './AttnNoiseSeenScene';

export const ATTN_NOISE_SCENES = {
  'attn-noise': () => <AttnNoiseScene />,
  'attn-noise-seen': () => <AttnNoiseSeenScene />,
} satisfies Readonly<Record<string, ComponentType>>;
