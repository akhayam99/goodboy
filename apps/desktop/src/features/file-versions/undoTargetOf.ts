import type { RestoreOutcome, RestoreTarget } from './useChangesRestore';

type DoneOutcome = Extract<RestoreOutcome, { kind: 'done' }>;

type Params = Readonly<{ outcome: DoneOutcome }>;

export const undoTargetOf = ({ outcome }: Params): RestoreTarget => ({
  ...outcome.target,
  id: `undo:${outcome.target.id}`,
  scope: 'undo',
  steps: outcome.restored.map((entry) => ({
    folderPath: entry.folderPath,
    runId: entry.restoreRunId,
  })),
});
