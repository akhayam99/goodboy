import type { LiveTerminal } from '../../../terminal/terminal';
import { isBusyTerminal } from '../../../terminal/isBusyTerminal';

export const LONG_COMMAND_MS = 10_000;

export type BusySince = ReadonlyMap<string, number>;

type FinishedTerminal = {
  readonly terminalId: string;
  readonly durationMs: number;
};

type Params = {
  readonly live: ReadonlyArray<LiveTerminal>;
  readonly busySince: BusySince;
  readonly now: number;
  readonly ownedIds: ReadonlySet<string>;
};

type Result = {
  readonly busySince: BusySince;
  readonly finished: ReadonlyArray<FinishedTerminal>;
};

export const terminalFinishesOf = ({ live, busySince, now, ownedIds }: Params): Result => {
  const nextBusySince = new Map<string, number>();
  for (const terminal of live) {
    if (ownedIds.has(terminal.id) && isBusyTerminal({ terminal })) {
      nextBusySince.set(terminal.id, busySince.get(terminal.id) ?? now);
    }
  }
  const finished: FinishedTerminal[] = [];
  for (const [terminalId, startedAt] of busySince) {
    const durationMs = now - startedAt;
    if (!nextBusySince.has(terminalId) && durationMs >= LONG_COMMAND_MS) {
      finished.push({ terminalId, durationMs });
    }
  }
  return { busySince: nextBusySince, finished };
};
