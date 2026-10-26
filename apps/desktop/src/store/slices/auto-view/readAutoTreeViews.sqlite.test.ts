import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { insertTurnEvent } from '@goodboy/db';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { autoGroupOf } from '../../../features/auto/autoGroupOf';
import { autoRetryTargetsOf } from '../../../features/auto/autoRetryTargetsOf';
import {
  batchInput,
  childInput,
  makeAutoWorld,
  type AutoWorld,
} from '../../runtime/auto/testing/autoWorld';
import { addOutboxRow } from '../../runtime/auto/testing/deliveryWorld';
import { readAutoTreeViews } from './readAutoTreeViews';
import { sameAutoTreeViews } from './sameAutoTreeViews';

const NORTHWIND = brandId<SessionId>({ value: 'session-northwind' });

type WorldParams = {
  readonly world: AutoWorld;
};

const addNorthwindSession = async ({ world }: WorldParams): Promise<void> => {
  await world.db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [NORTHWIND, 'workspace-harborline', 'ship notify-relay', 'idle', 0, 0],
  );
};

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

  it('leaves out a child that was deleted or moved, and keeps one not created yet', async () => {
    const world = await makeAutoWorld({ agentIds: ['agent-deleted', 'agent-moved', 'agent-kept'] });
    await world.scheduler.admit(
      batchInput({
        children: [
          childInput({ key: 'deleted' }),
          childInput({ key: 'moved' }),
          childInput({ key: 'kept' }),
          childInput({ key: 'unborn' }),
        ],
      }),
    );
    await addNorthwindSession({ world });
    await world.db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [
      world.clock.now(),
      'agent-deleted',
    ]);
    await world.db.execute('UPDATE agents SET session_id = ? WHERE id = ?', [
      NORTHWIND,
      'agent-moved',
    ]);

    const views = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });

    expect(views[0]?.delegations.map((delegation) => delegation.childAgentId)).toEqual([
      'agent-kept',
      'agent-unborn',
    ]);
  });

  it('keeps a failed attempt out of Next and Now once the attempt after it is gone', async () => {
    const world = await makeAutoWorld({ agentIds: ['agent-first', 'agent-again'] });
    await world.scheduler.admit(
      batchInput({
        children: [
          childInput({ key: 'first', role: 'implementer' }),
          childInput({ key: 'again', role: 'implementer' }),
        ],
      }),
    );
    await world.db.execute(
      "UPDATE auto_delegations SET state = 'settled', outcome = 'failed', settled_at = ?, created_at = created_at - 1 WHERE id = ?",
      [world.clock.now(), 'delegation-first'],
    );
    await world.db.execute('UPDATE agents SET deleted_at = ? WHERE id = ?', [
      world.clock.now(),
      'agent-again',
    ]);
    const agents = [
      anAgent({ id: AUTO_SEED_ROOT, kind: 'auto', status: 'running' }),
      anAgent({
        id: brandId<AgentId>({ value: 'agent-first' }),
        kind: 'implementer',
        status: 'failed',
        parentAgentId: AUTO_SEED_ROOT,
      }),
    ];

    const views = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    const view = views[0];
    if (view === undefined) {
      throw new Error('no tree');
    }
    const now = world.clock.now();
    const group = autoGroupOf({ view, agents, now });

    expect(view.delegations).toEqual([]);
    expect(view.hiddenChildIds).toEqual(['agent-first', 'agent-again']);
    expect(group?.children).toEqual([]);
    expect(group?.isStuck).toBe(false);
    expect(autoRetryTargetsOf({ views, agents, now })).toEqual([]);
  });

  it('shows a moved child in the session that holds it now', async () => {
    const world = await makeAutoWorld({ agentIds: ['agent-moved'] });
    await world.scheduler.admit(batchInput({ children: [childInput({ key: 'moved' })] }));
    await addNorthwindSession({ world });
    await world.db.execute('UPDATE agents SET session_id = ? WHERE id IN (?, ?)', [
      NORTHWIND,
      'agent-moved',
      AUTO_SEED_ROOT,
    ]);
    await world.db.execute('UPDATE auto_trees SET session_id = ?', [NORTHWIND]);

    const before = await readAutoTreeViews({ db: world.db, sessionId: AUTO_SEED_SESSION });
    const after = await readAutoTreeViews({ db: world.db, sessionId: NORTHWIND });

    expect(before).toEqual([]);
    expect(after[0]?.delegations.map((delegation) => delegation.childAgentId)).toEqual([
      'agent-moved',
    ]);
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
