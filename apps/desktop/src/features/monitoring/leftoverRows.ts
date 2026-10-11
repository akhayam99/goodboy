import type { LedgerKind, LedgerRow, Leftover } from '@goodboy/core';
import type { Session } from '@goodboy/types';
import { sessionById } from '../../store/slices/sessions/sessionIndex';

type Params = {
  readonly leftovers: ReadonlyArray<Leftover>;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly sessions: ReadonlyArray<Session>;
};

export type LeftoverRow = {
  readonly spawnId: string;
  readonly name: string;
  readonly startedBy: string;
  readonly startedAt: number;
  readonly pids: ReadonlyArray<number>;
};

const STARTER_PHRASE: Readonly<Record<LedgerKind, string>> = {
  turn: 'an agent',
  chat: 'a chat agent',
  planner: 'the planner',
  summary: 'a summary agent',
  script: 'a script',
  terminal: 'a terminal',
  probe: 'a probe',
};

export const leftoverRows = ({ leftovers, ledger, sessions }: Params): ReadonlyArray<LeftoverRow> =>
  leftovers.map((leftover) => {
    const entry = ledger.find((row) => row.spawnId === leftover.spawnId);
    const session =
      leftover.sessionId === null ? undefined : sessionById(sessions, leftover.sessionId);
    const starter = `started by ${STARTER_PHRASE[leftover.kind]}`;
    const oldest = Math.min(...leftover.processes.map((process) => process.startedAt));
    return {
      spawnId: leftover.spawnId,
      name: leftover.processes[0]?.name ?? 'process',
      startedBy: session === undefined ? starter : `${starter} in ${session.goal}`,
      startedAt: entry?.startedAt ?? oldest,
      pids: leftover.processes.map((process) => process.pid),
    };
  });
