import type { ComponentType } from 'react';
import { AfterAnalyzeScene } from './AfterAnalyzeScene';

export const U26_NEXT_FOLLOW_UPS_SCENES: Readonly<Record<string, ComponentType>> = {
  'overview-after-analyze-light': () => <AfterAnalyzeScene theme="light" phase="proposal" />,
  'overview-after-analyze-dark': () => <AfterAnalyzeScene theme="dark" phase="proposal" />,
  'overview-after-fix-light': () => <AfterAnalyzeScene theme="light" phase="fixed-local" />,
  'overview-after-fix-dark': () => <AfterAnalyzeScene theme="dark" phase="fixed-local" />,
};
