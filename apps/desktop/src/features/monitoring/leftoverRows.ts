import type { LedgerKind, LedgerRow, Leftover } from '@goodboy/core/monitoring';
import type { Session } from '@goodboy/types';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { mountContaining } from './mountContaining';
import type { OwnedMount } from './ownedMountsOf';

type Params = {
  readonly leftovers: ReadonlyArray<Leftover>;
  readonly ledger: ReadonlyArray<LedgerRow>;
  readonly sessions: ReadonlyArray<Session>;
  readonly mounts: ReadonlyArray<OwnedMount>;
};

export type LeftoverRow = {
  readonly spawnId: string;
  readonly name: string;
  readonly startedBy: string;
  readonly startedAt: number;
  readonly pids: ReadonlyArray<number>;
  readonly mount: OwnedMount | null;
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

export const leftoverRows = ({
  leftovers,
  ledger,
  sessions,
  mounts,
}: Params): ReadonlyArray<LeftoverRow> =>
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
      mount: mountContaining({
        mounts,
        sessionId: leftover.sessionId ?? entry?.sessionId ?? null,
        path: leftover.mountPath ?? entry?.mountPath ?? entry?.cwd ?? null,
      }),
    };
  });
