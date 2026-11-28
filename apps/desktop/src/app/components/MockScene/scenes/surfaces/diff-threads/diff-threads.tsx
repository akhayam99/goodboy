import type { ComponentType } from 'react';
import { DiffThreadsScene } from './DiffThreadsScene';

export const DIFF_THREADS_SCENES = {
  'diff-threads': DiffThreadsScene,
} satisfies Readonly<Record<string, ComponentType>>;
