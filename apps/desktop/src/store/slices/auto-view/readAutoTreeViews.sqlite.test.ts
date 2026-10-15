import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { batchInput, childInput, makeAutoWorld } from '../auto/testing/autoWorld';
import { readAutoTreeViews } from './readAutoTreeViews';
import { sameAutoTreeViews } from './sameAutoTreeViews';

describe('readAutoTreeViews', () => {
  it('reads the tree, its delegations and one budget from the registry', async () => {
    const world = await makeAutoWorld();
    await world.scheduler.admit(
      batchInput({
        children: [childInput({ key: 'a' }), childInput({ key: 'b', role: 'planner' })],
      }),
    );

    const views = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });

    expect(views).toHaveLength(1);
    expect(views[0]?.tree).toMatchObject({ phase: 'delegating', delegationsUsed: 2 });
    expect(views[0]?.delegations.map((delegation) => delegation.role)).toEqual([
      'scout',
      'planner',
    ]);
    expect(views[0]?.budget).toMatchObject({ capUsd: 5, reservedUsd: 1.25, remainingUsd: 3.75 });
  });

  it('is empty for a session without an Auto tree', async () => {
    const world = await makeAutoWorld();

    const views = await readAutoTreeViews({
      db: world.db,
      sessionId: brandId<SessionId>({ value: 'session-without-auto' }),
    });

    expect(views).toEqual([]);
  });

  it('tells a changed view from one that only has a newer read time', async () => {
    const world = await makeAutoWorld();
    const first = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    const again = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    expect(sameAutoTreeViews({ first, second: again })).toBe(true);

    await world.scheduler.admit(batchInput({ children: [childInput({ key: 'a' })] }));
    const later = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });

    expect(sameAutoTreeViews({ first, second: later })).toBe(false);
  });
});
