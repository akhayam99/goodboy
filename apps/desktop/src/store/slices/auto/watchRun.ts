import type { AutoPorts, ReadRunOutcomeParams, RunOutcome } from './ports';
import type { SleepParams } from './startDeliveredTurn';

export const WATCH_RUN_POLL_MS = 1_000;

export type WatchRunParams = Readonly<{
  ports: AutoPorts;
  run: ReadRunOutcomeParams;
  sleep: (params: SleepParams) => Promise<void>;
  maxPolls: number;
}>;

export type WatchedRun =
  Readonly<{ kind: 'gone'; outcome: RunOutcome | null }> | Readonly<{ kind: 'still_live' }>;

export const watchRun = async ({
  ports,
  run,
  sleep,
  maxPolls,
}: WatchRunParams): Promise<WatchedRun> => {
  for (let poll = 0; poll < maxPolls; poll += 1) {
    const isLive = await ports.isRunLive({ runId: run.runId });
    if (!isLive) {
      return { kind: 'gone', outcome: await ports.readRunOutcome(run) };
    }
    await sleep({ ms: WATCH_RUN_POLL_MS });
  }
  return { kind: 'still_live' };
};
