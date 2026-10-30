import type { ComponentType } from 'react';
import { NewSinceScene } from './NewSinceScene';

export const U30_NEW_SINCE_SCENES = {
  'u30-new-since': () => <NewSinceScene theme="dark" />,
} satisfies Readonly<Record<string, ComponentType>>;
