import type { ScriptLedgerEntry } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';

export type WorkLedgerState = {
  readonly scriptLedger: Readonly<Record<SessionId, ReadonlyArray<ScriptLedgerEntry>>>;
};

export const workLedgerInitialState: WorkLedgerState = {
  scriptLedger: {},
};
