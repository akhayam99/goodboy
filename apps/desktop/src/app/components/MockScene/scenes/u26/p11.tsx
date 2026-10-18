import type { ComponentType } from 'react';
import { AutoResultsScene } from './AutoResultsScene';

export const U26_P11_SCENES: Readonly<Record<string, ComponentType>> = {
  'u26-auto-results-light': () => <AutoResultsScene theme="light" />,
  'u26-auto-results-dark': () => <AutoResultsScene theme="dark" />,
};
