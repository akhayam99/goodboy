import type { WorkNodeState } from '@goodboy/ui';

export type LeadTreeRootState = Readonly<{
  node: WorkNodeState;
  word: string;
  ask: string | null;
}>;
