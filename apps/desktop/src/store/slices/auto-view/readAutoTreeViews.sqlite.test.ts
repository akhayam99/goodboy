import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime, type ProviderRunId, type SessionId } from '@goodboy/types';
import { insertTurnEvent } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { batchInput, childInput, makeAutoWorld } from '../auto/testing/autoWorld';
import { addOutboxRow } from '../auto/testing/deliveryWorld';
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
    expect(views[0]?.budget).toMatchObject({ capUsd: 5, reservedUsd: 0, remainingUsd: 5 });
  });

  it('carries the first ask the root was started with, without its transcript', async () => {
    const world = await makeAutoWorld();
    const before = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    const rootAgentId = before[0]?.tree.rootAgentId;
    if (rootAgentId === undefined) {
      throw new Error('no tree');
    }
    expect(before[0]?.rootAsk).toBeNull();
    const at = brandId<IsoDateTime>({ value: new Date(world.clock.now()).toISOString() });
    const runId = brandId<ProviderRunId>({ value: 'mock-run-ask' });
    await insertTurnEvent(world.db, {
      id: 'ask-1',
      sessionId: AUTO_SEED_SESSION,
      agentId: rootAgentId,
      event: { kind: 'user_text', runId, text: 'Fix the ledger-core retry\nwith tests', at },
    });
    await insertTurnEvent(world.db, {
      id: 'ask-2',
      sessionId: AUTO_SEED_SESSION,
      agentId: rootAgentId,
      event: { kind: 'user_text', runId, text: 'Results from the scout', at },
    });

    const after = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });

    expect(after[0]?.rootAsk).toBe('Fix the ledger-core retry\nwith tests');
    expect(sameAutoTreeViews({ first: before, second: after })).toBe(false);
  });

  it('titles an Auto root by the operator ask, never by the delivery Auto sent its root', async () => {
    const world = await makeAutoWorld();
    const before = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    const rootAgentId = before[0]?.tree.rootAgentId;
    if (rootAgentId === undefined) {
      throw new Error('no tree');
    }
    const at = brandId<IsoDateTime>({ value: new Date(world.clock.now()).toISOString() });
    const runId = brandId<ProviderRunId>({ value: 'mock-run-delivery' });
    await insertTurnEvent(world.db, {
      id: 'delivery-1',
      sessionId: AUTO_SEED_SESSION,
      agentId: rootAgentId,
      event: {
        kind: 'user_text',
        runId,
        text: 'Artifacts in this tree, as of 2026-10-21T10:00:00.000Z, generation 1.',
        deliveredBy: 'auto',
        at,
      },
    });
    await insertTurnEvent(world.db, {
      id: 'operator-1',
      sessionId: AUTO_SEED_SESSION,
      agentId: rootAgentId,
      event: { kind: 'operator_text', runId, text: 'Add refunds to payments-api', at },
    });

    const views = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });

    expect(views[0]?.rootAsk).toBe('Add refunds to payments-api');
  });

  it('reads the newest pending refusal of the current generation, and drops it once delivered', async () => {
    const world = await makeAutoWorld();
    const refusal = (code: string) => ({
      kind: 'refusal',
      runId: `run-${code}`,
      action: 'delegate',
      code,
      text: 'refused',
      roles: ['implementer'],
    });
    await addOutboxRow({ world, id: 'refusal-old', kind: 'refusal', payload: refusal('budget') });
    await addOutboxRow({
      world,
      id: 'refusal-stale-generation',
      kind: 'refusal',
      payload: refusal('tree_busy'),
      generation: 2,
      atMs: world.clock.now() + 2,
    });
    await addOutboxRow({
      world,
      id: 'refusal-new',
      kind: 'refusal',
      payload: refusal('mount_ambiguous'),
      atMs: world.clock.now() + 1,
    });

    const views = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    expect(views[0]?.pendingRefusal).toEqual({
      action: 'delegate',
      code: 'mount_ambiguous',
      roles: ['implementer'],
    });

    await world.db.execute("UPDATE auto_outbox SET state = 'accepted' WHERE kind = 'refusal'", []);
    const later = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    expect(later[0]?.pendingRefusal).toBeNull();
    expect(sameAutoTreeViews({ first: views, second: later })).toBe(false);
  });

  it('reads an old refusal row without roles as a refusal of no named role', async () => {
    const world = await makeAutoWorld();
    await addOutboxRow({
      world,
      id: 'refusal-legacy',
      kind: 'refusal',
      payload: {
        kind: 'refusal',
        runId: 'run-1',
        action: 'block',
        code: 'spec_invalid',
        text: 'x',
      },
    });

    const views = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    expect(views[0]?.pendingRefusal).toEqual({ action: 'block', code: 'spec_invalid', roles: [] });
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
