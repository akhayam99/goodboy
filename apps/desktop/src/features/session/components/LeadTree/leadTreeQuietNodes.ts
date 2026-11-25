import type { WorkNodeState } from '@goodboy/ui';

export const LEAD_TREE_QUIET_NODES: ReadonlySet<WorkNodeState> = new Set(['done']);

export const LEAD_TREE_MUTED_NODES: ReadonlySet<WorkNodeState> = new Set([
  'failed',
  'stopped',
  'closed',
  'skipped',
]);
