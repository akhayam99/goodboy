// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAutoTree,
  listAutoDelegations,
  listAutoOutbox,
  setSetting,
  setWorkspaceValue,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import {
  AUTO_SEED_SESSION,
  seedAutoSession,
  seedPlanArtifact,
} from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type IsoDateTime,
  type ProviderRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import { invokeAgentList } from '../workflows/workflows';
import { moveToAuto } from './moveToAuto';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const RUN = brandId<ProviderRunId>({ value: 'run-1' });
const AT = brandId<IsoDateTime>({ value: '2025-01-01T00:00:00.000Z' });

let db: Database;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  await seedAutoSession({ db, agentIds: ['agent-source'] });
  await db.execute("UPDATE agents SET name = 'Implementer', kind = 'implementer' WHERE id = ?", [
    SOURCE,
  ]);
  await seedPlanArtifact({ db, id: 'plan-retry', agentId: 'agent-source' });
  const agents = await invokeAgentList(AUTO_SEED_SESSION);
  useAppStore.setState({
    sessions: [aSession({ id: AUTO_SEED_SESSION, workspaceId: WORKSPACE })],
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: agents },
    agentTurnState: {},
    agentKindOverride: {},
    autoTreeViews: {},
    sessionBudgets: {},
    settings: {},
    transcripts: {
      [SOURCE]: [
        { kind: 'user_text', runId: RUN, text: 'Add the retry cap to ledger-core', at: AT },
        { kind: 'assistant_text', runId: RUN, delta: 'Added the cap and a test.', at: AT },
      ],
    },
  });
});

type MoveParams = {
  readonly instruction?: string;
};

const move = ({ instruction = 'Test it, then review it.' }: MoveParams = {}) =>
  moveToAuto({
    db,
    isReleased: true,
    sessionId: AUTO_SEED_SESSION,
    agentId: SOURCE,
    instruction,
  });

describe('moving an agent to Auto from the app', () => {
  it('moves the agent even when an old experiment row still says false', async () => {
    await setSetting(db, 'agents.autoExperiment', 'false');

    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
  });

  it('stays off while the release gate is closed', async () => {
    const outcome = await moveToAuto({
      db,
      isReleased: false,
      sessionId: AUTO_SEED_SESSION,
      agentId: SOURCE,
      instruction: '',
    });

    expect(outcome.kind).toBe('off');
  });

  it('moves the agent, tells Auto what the user asked and what the agent said, and refreshes the lists', async () => {
    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
    if (outcome.kind !== 'adopted') {
      return;
    }
    const outbox = await listAutoOutbox({ db, treeId: outcome.treeId });
    const text = JSON.stringify(outbox[0]?.payload);
    expect(text).toContain('Add the retry cap to ledger-core');
    expect(text).toContain('Added the cap and a test.');
    expect(text).toContain('Test it, then review it.');
    expect(text).toContain('plan-retry');
    expect(
      useAppStore.getState().sessionPhaseRuns[AUTO_SEED_SESSION]?.map((agent) => agent.id),
    ).toContain(outcome.autoAgentId);
    expect(useAppStore.getState().autoTreeViews[AUTO_SEED_SESSION]?.[0]?.delegations).toHaveLength(
      1,
    );
  });

  it('sizes the cap from the limit stored for the workspace', async () => {
    await setWorkspaceValue({
      db,
      workspaceId: WORKSPACE,
      key: 'auto.treeLimitUsd',
      value: '8',
    });

    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
    if (outcome.kind === 'adopted') {
      expect((await getAutoTree({ db, treeId: outcome.treeId }))?.capUsd).toBe(8);
    }
  });

  it('caps the new Auto at a smaller session budget only when that budget pauses', async () => {
    await setWorkspaceValue({ db, workspaceId: WORKSPACE, key: 'auto.treeLimitUsd', value: '8' });
    useAppStore.setState({
      sessionBudgets: {
        [AUTO_SEED_SESSION]: {
          sessionId: AUTO_SEED_SESSION,
          softCapUsd: 3,
          onExceed: 'pause',
          warnRatio: 0.8,
        },
      },
    });

    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
    if (outcome.kind === 'adopted') {
      expect((await getAutoTree({ db, treeId: outcome.treeId }))?.capUsd).toBe(3);
    }
  });

  it('leaves the new Auto at the workspace limit under a session budget that only warns', async () => {
    await setWorkspaceValue({ db, workspaceId: WORKSPACE, key: 'auto.treeLimitUsd', value: '8' });
    useAppStore.setState({
      sessionBudgets: {
        [AUTO_SEED_SESSION]: {
          sessionId: AUTO_SEED_SESSION,
          softCapUsd: 3,
          onExceed: 'warn',
          warnRatio: 0.8,
        },
      },
    });

    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
    if (outcome.kind === 'adopted') {
      expect((await getAutoTree({ db, treeId: outcome.treeId }))?.capUsd).toBe(8);
    }
  });

  it('refuses while the agent is working, and works once its turn is over', async () => {
    useAppStore.setState({
      agentTurnState: { [SOURCE]: { kind: 'running', runId: RUN, startedAt: AT } },
    });

    expect(await move()).toMatchObject({ kind: 'refused', code: 'turn_running' });
    expect(await db.select('SELECT id FROM auto_trees')).toEqual([]);

    useAppStore.setState({ agentTurnState: {} });
    expect((await move()).kind).toBe('adopted');
  });

  it('gives the same Auto back on a second click', async () => {
    const first = await move();
    const second = await move();

    expect(second).toMatchObject({
      kind: 'exists',
      autoAgentId: first.kind === 'adopted' ? first.autoAgentId : '',
    });
    expect(
      await listAutoDelegations({
        db,
        treeId: first.kind === 'adopted' ? first.treeId : brandId<AutoTreeId>({ value: 'none' }),
      }),
    ).toHaveLength(1);
  });
});
