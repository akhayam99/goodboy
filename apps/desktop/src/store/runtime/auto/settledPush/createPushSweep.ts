import type { AgentVerbContext } from '../verbContext';
import { PUSH_LIVE_WINDOW_MS } from './PUSH_LIVE_WINDOW_MS';
import { PUSH_SWEEP_RETRY_MS } from './PUSH_SWEEP_RETRY_MS';
import { sweepStalePushing } from './sweepStalePushing';

export type PushSweepErrorParams = Readonly<{
  error: unknown;
}>;

export type CreatePushSweepParams = Readonly<{
  ctx: AgentVerbContext;
  onError: (params: PushSweepErrorParams) => void;
}>;

type NextDueParams = {
  readonly nowMs: number;
  readonly live: number;
  readonly failed: number;
};

const nextDueAt = ({ nowMs, live, failed }: NextDueParams): number | null => {
  if (failed > 0) {
    return nowMs + PUSH_SWEEP_RETRY_MS;
  }
  return live > 0 ? nowMs + PUSH_LIVE_WINDOW_MS : null;
};

export const createPushSweep = ({ ctx, onError }: CreatePushSweepParams): (() => Promise<void>) => {
  let dueAt: number | null = 0;
  let running: Promise<void> | null = null;
  return (): Promise<void> => {
    if (running !== null) {
      return running;
    }
    if (dueAt === null || ctx.now() < dueAt) {
      return Promise.resolve();
    }
    running = sweepStalePushing({ ctx })
      .then(({ live, failed }) => {
        dueAt = nextDueAt({ nowMs: ctx.now(), live, failed: failed.length });
        for (const error of failed) {
          onError({ error });
        }
      })
      .catch((error: unknown) => {
        dueAt = ctx.now() + PUSH_SWEEP_RETRY_MS;
        onError({ error });
      })
      .finally(() => {
        running = null;
      });
    return running;
  };
};
