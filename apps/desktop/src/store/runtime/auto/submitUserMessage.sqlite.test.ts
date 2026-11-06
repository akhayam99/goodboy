import { describe, expect, it } from 'vitest';
import { listAutoOutbox } from '@goodboy/db';
import { submitUserMessage } from './submitUserMessage';
import { makeRuntimeWorld, type RuntimeWorld } from './testing/runtimeWorld';

const TEXT = 'Also cover the 402 path in payments-api';

const userRows = async (world: RuntimeWorld) =>
  (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).filter(
    (row) => row.kind === 'user',
  );

describe('a user message to Auto', () => {
  it('lands once when a queued message is sent again after a crash', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    const send = () =>
      submitUserMessage({
        ctx: world.state.ctx,
        treeId: world.treeId,
        text: TEXT,
        deliveryId: 'queue:send-auto-1',
      });

    const first = await send();
    const again = await send();

    expect(first).toMatchObject({ kind: 'queued' });
    expect(again).toEqual({
      kind: 'queued',
      rowId: first.kind === 'queued' ? first.rowId : '',
      isRepeat: true,
    });
    const rows = await userRows(world);
    expect(rows.map((row) => row.joinKey)).toEqual(['user:queue:send-auto-1']);
  });

  it('keeps two messages with the same words and no delivery id as two rows', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });

    await submitUserMessage({ ctx: world.state.ctx, treeId: world.treeId, text: TEXT });
    await submitUserMessage({ ctx: world.state.ctx, treeId: world.treeId, text: TEXT });

    expect(await userRows(world)).toHaveLength(2);
  });
});
