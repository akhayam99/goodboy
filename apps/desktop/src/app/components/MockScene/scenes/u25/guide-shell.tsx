import type { ComponentType } from 'react';
import { GuideChapterScene } from './GuideChapterScene';

export const U25_GUIDE_SHELL_SCENES: Readonly<Record<string, ComponentType>> = {
  'guide-shell': () => <GuideChapterScene chapter="shell" />,
  'guide-legend': () => <GuideChapterScene chapter="legend" />,
};
