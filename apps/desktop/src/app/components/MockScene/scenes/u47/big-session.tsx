import type { ComponentType } from 'react';
import { BigSessionScene } from './BigSessionScene';

export const U47_BIG_SESSION_SCENES = {
  'u47-big-session-overview': () => <BigSessionScene />,
  'u47-big-session-log': () => <BigSessionScene isLogOpen />,
} satisfies Readonly<Record<string, ComponentType>>;
