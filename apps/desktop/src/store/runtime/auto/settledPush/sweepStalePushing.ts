import { brandId, type AutoAttemptId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';
import { pushSettledPublish, type PushSettledOutcome } from './pushSettledPublish';

export type SweepStalePushingParams = Readonly<{
  ctx: AgentVerbContext;
}>;

export type SweepOutcome = Readonly<{
  swept: number;
  live: number;
  failed: ReadonlyArray<unknown>;
}>;

type StaleRow = {
  readonly id: string;
};

type OneParams = {
  readonly ctx: AgentVerbContext;
  readonly id: string;
};

const sweepOne = ({ ctx, id }: OneParams): Promise<PushSettledOutcome | Error> =>
  pushSettledPublish({ ctx, attemptId: brandId<AutoAttemptId>({ value: id }) }).catch(
    (error: unknown): Error => (error instanceof Error ? error : new Error(String(error))),
  );

export const sweepStalePushing = async ({
  ctx,
}: SweepStalePushingParams): Promise<SweepOutcome> => {
  const rows = await ctx.db.select<StaleRow>(
    `SELECT id FROM auto_attempts
     WHERE state = 'ended'
       AND json_extract(result_snapshot_json, '$.envelope.verified.publish.state') = 'pushing'
       AND json_extract(result_snapshot_json, '$.envelope.verified.publish.isConfirmed') = 1
     ORDER BY id`,
  );
  let swept = 0;
  let live = 0;
  const failed: unknown[] = [];
  for (const row of rows) {
    const outcome = await sweepOne({ ctx, id: row.id });
    if (outcome instanceof Error) {
      failed.push(outcome);
    }
    if (outcome === 'interrupted') {
      swept += 1;
    }
    if (outcome === 'live') {
      live += 1;
    }
  }
  return { swept, live, failed };
};
