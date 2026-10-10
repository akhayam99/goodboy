import { invokeCommand } from './invokeCommand';

export type ProcessLedgerKind =
  'turn' | 'chat' | 'planner' | 'summary' | 'script' | 'terminal' | 'probe';

export type ProcessLedgerEntry = {
  readonly spawnId: string;
  readonly kind: ProcessLedgerKind;
  readonly pid: number;
  readonly pgid: number | null;
  readonly sessionId: string | null;
  readonly mountPath: string | null;
  readonly cwd: string | null;
  readonly startedAt: number;
};

export const invokeProcessLedgerList = (): Promise<ReadonlyArray<ProcessLedgerEntry>> => {
  return invokeCommand<ReadonlyArray<ProcessLedgerEntry>>('process_ledger_list');
};
