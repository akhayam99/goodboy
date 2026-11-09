import { brandId, type AutoAttemptId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';
import { pushSettledPublish } from './pushSettledPublish';

export type SweepStalePushingParams = Readonly<{
  ctx: AgentVerbContext;
}>;

type StaleRow = {
  readonly id: string;
};

export const sweepStalePushing = async ({ ctx }: SweepStalePushingParams): Promise<number> => {
  const rows = await ctx.db.select<StaleRow>(
    `SELECT id FROM auto_attempts
     WHERE state = 'ended'
       AND json_extract(result_snapshot_json, '$.envelope.verified.publish.state') = 'pushing'
       AND json_extract(result_snapshot_json, '$.envelope.verified.publish.isConfirmed') = 1
     ORDER BY id`,
  );
  let swept = 0;
  for (const row of rows) {
    const outcome = await pushSettledPublish({
      ctx,
      attemptId: brandId<AutoAttemptId>({ value: row.id }),
    });
    if (outcome === 'interrupted') {
      swept += 1;
    }
  }
  return swept;
};
