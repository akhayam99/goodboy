import type { ComponentType } from 'react';
import { ListsScene } from './ListsScene';

export const U31_LISTS_SCENES = {
  'u31-questions': () => <ListsScene page="questions" />,
  'u31-artifacts': () => <ListsScene page="artifacts" />,
  'u31-question-card': () => <ListsScene page="card" />,
} satisfies Readonly<Record<string, ComponentType>>;
