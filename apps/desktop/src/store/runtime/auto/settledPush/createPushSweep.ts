import type { AgentVerbContext } from '../verbContext';
import { PUSH_LIVE_WINDOW_MS } from './PUSH_LIVE_WINDOW_MS';
import { sweepStalePushing } from './sweepStalePushing';

export type PushSweepErrorParams = Readonly<{
  error: unknown;
}>;

export type CreatePushSweepParams = Readonly<{
  ctx: AgentVerbContext;
  onError: (params: PushSweepErrorParams) => void;
}>;

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
        dueAt = live > 0 ? ctx.now() + PUSH_LIVE_WINDOW_MS : null;
        for (const error of failed) {
          onError({ error });
        }
      })
      .catch((error: unknown) => {
        dueAt = null;
        onError({ error });
      })
      .finally(() => {
        running = null;
      });
    return running;
  };
};
