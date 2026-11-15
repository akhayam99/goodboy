import type { AutoDelegation, PlainStatement } from '@goodboy/db';

type Params = {
  readonly delegation: AutoDelegation;
  readonly nowMs: number;
};

export const bumpTreeStatement = ({ delegation, nowMs }: Params): PlainStatement => ({
  sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
  params: [nowMs, delegation.treeId],
});
