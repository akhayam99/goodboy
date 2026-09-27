import { describe, expect, it } from 'vitest';
import { listContextSlotsForSession, migrate, upsertContextSlot } from '@goodboy/db';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import { applyDecisionOpsToSession, loadDecisionLedger } from './decisions-ledger-store';
import { autoPopulateContext } from './auto-populate';

const SESSION = 'session_ledger' as SessionId;

const makeSession = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  const workspaceId = 'ws_ledger' as WorkspaceId;
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'Harborline', workspaceId, 0, 0],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [SESSION, workspaceId, 'Checkout', 'idle', 0, 0],
  );
  return db;
};

const decisionsSlot = async (db: Awaited<ReturnType<typeof makeSession>>) =>
  (await listContextSlotsForSession(db, SESSION)).find((slot) => slot.key === 'decisions')?.value;

describe('decision ledger store', () => {
  it('seeds the ledger from the slot of a session made before it', async () => {
    const db = await makeSession();
    await upsertContextSlot(db, SESSION, {
      key: 'decisions',
      value: '- Fix only payments-api\n- Return 200 on a duplicate delivery',
      enabled: true,
    });

    const ledger = await loadDecisionLedger({ db, sessionId: SESSION });

    expect(ledger.map((row) => row.number)).toEqual([1, 2]);
    expect(await decisionsSlot(db)).toBe(
      '- D2 Return 200 on a duplicate delivery\n- D1 Fix only payments-api',
    );
    expect(await loadDecisionLedger({ db, sessionId: SESSION })).toHaveLength(2);
  });

  it('writes the derived slot after each application', async () => {
    const db = await makeSession();

    const applied = await applyDecisionOpsToSession({
      db,
      sessionId: SESSION,
      ops: [{ kind: 'add', text: 'Key on the event id' }],
      actor: { author: 'user', agentId: null, turnOrdinal: null },
    });

    expect(applied.previousSlotValue).toBe('');
    expect(applied.slotValue).toBe('- D1 Key on the event id');
    expect(await decisionsSlot(db)).toBe('- D1 Key on the event id');
  });

  it('lets an agent replace and withdraw by number through its markers', async () => {
    const db = await makeSession();
    await applyDecisionOpsToSession({
      db,
      sessionId: SESSION,
      ops: [
        { kind: 'add', text: 'Detect duplicates by hashing the payload' },
        { kind: 'add', text: 'Add a retry counter column to invoices' },
      ],
      actor: { author: 'agent', agentId: null, turnOrdinal: 1 },
    });

    const result = await autoPopulateContext({
      db,
      sessionId: SESSION,
      filesEdited: [],
      assistantText: [
        '<<ctx-decision replaces="D1">>Key idempotency on the provider event id<</ctx-decision>>',
        '<<ctx-decision withdraw="D2">>The ledger already keeps retry state<</ctx-decision>>',
      ].join('\n'),
      agentContext: { agentId: 'implementer' as AgentId, turnOrdinal: 9 },
    });

    expect(result.updatedSlots).toEqual(['decisions']);
    expect(result.decisionChanges.map((change) => change.kind)).toEqual(['replaced', 'withdrawn']);
    expect(await decisionsSlot(db)).toBe('- D3 Key idempotency on the provider event id');
  });
});
