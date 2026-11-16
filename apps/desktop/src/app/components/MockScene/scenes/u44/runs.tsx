import type { ComponentType } from 'react';
import { U44RunsScene } from './U44RunsScene';

const START_TEXT = 'Make the ledger export retry safe when the bank times out';

export const U44_RUNS_SCENES = {
  'u44-runs-list': () => <U44RunsScene startText={null} />,
  'u44-runs-start-open': () => <U44RunsScene startText={START_TEXT} />,
} satisfies Readonly<Record<string, ComponentType>>;
