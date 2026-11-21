import type { ScriptLedgerEntry } from '@goodboy/db';

type Params = {
  readonly before: ReadonlyArray<ScriptLedgerEntry>;
  readonly after: ReadonlyArray<ScriptLedgerEntry>;
};

export const sameLedger = ({ before, after }: Params): boolean =>
  before.length === after.length &&
  before.every((entry, index) => {
    const next = after[index];
    return (
      next !== undefined &&
      next.scriptId === entry.scriptId &&
      next.mountId === entry.mountId &&
      next.runId === entry.runId &&
      next.endedAt === entry.endedAt &&
      next.exitCode === entry.exitCode &&
      next.runCount === entry.runCount
    );
  });
