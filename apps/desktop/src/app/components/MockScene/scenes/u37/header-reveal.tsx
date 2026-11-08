import type { ComponentType } from 'react';
import { HeaderRevealScene } from './HeaderRevealScene';

export const U37_HEADER_REVEAL_SCENES: Readonly<Record<string, ComponentType>> = {
  'u37-header-reveal': () => <HeaderRevealScene still="top" />,
  'u37-header-reveal-reading': () => <HeaderRevealScene still="reading" />,
  'u37-header-reveal-back': () => <HeaderRevealScene still="back" />,
};
