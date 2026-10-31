import type { ComponentType } from 'react';
import { HeaderScene } from './HeaderScene';

export const U31_HEADER_SCENES = {
  'u31-header': () => <HeaderScene />,
} satisfies Readonly<Record<string, ComponentType>>;
