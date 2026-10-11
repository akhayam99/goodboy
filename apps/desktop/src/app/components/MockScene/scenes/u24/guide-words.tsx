import type { ComponentType } from 'react';
import { GuideWordsScene } from './GuideWordsScene';
import { HovercardLegendLinkScene } from './HovercardLegendLinkScene';

export const U24_GUIDE_WORDS_SCENES: Readonly<Record<string, ComponentType>> = {
  'guide-words': GuideWordsScene,
  'hovercard-legend-link': HovercardLegendLinkScene,
};
