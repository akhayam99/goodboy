import type { ComponentType } from 'react';
import { PrEntryScene } from './PrEntryScene';

export const U50_PR_ENTRY_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-pr-entry-checks-light': () => <PrEntryScene theme="light" view="checks" />,
  'u50-pr-entry-checks-dark': () => <PrEntryScene theme="dark" view="checks" />,
  'u50-pr-entry-blocks-light': () => <PrEntryScene theme="light" view="blocks" />,
  'u50-pr-entry-blocks-dark': () => <PrEntryScene theme="dark" view="blocks" />,
};
