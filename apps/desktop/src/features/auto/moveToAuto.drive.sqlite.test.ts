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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAutoTree, setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import { createAutoRuntime } from '../../store/slices/auto/createAutoRuntime';
import { createAutoScheduler } from '../../store/slices/auto/scheduler';
import { makeFakePorts } from '../../store/slices/auto/testing/fakePorts';
import type { AppStore } from '../../store/store';
import { invokeAgentList } from '../workflows/workflows';
import { SETTING_AUTO_EXPERIMENT } from '../settings/settings';
import { registerAutoDrivePort } from './autoDrivePort';
import { moveToAuto } from './moveToAuto';

const SOURCE = brandId<AgentId>({ value: 'agent-source' });
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
  await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');
  useAppStore.setState({
    sessions: [
      aSession({
        id: AUTO_SEED_SESSION,
        workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }),
      }),
    ],
    sessionPhaseRuns: { [AUTO_SEED_SESSION]: await invokeAgentList(AUTO_SEED_SESSION) },
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

afterEach(() => {
  registerAutoDrivePort({ port: null });
});

const move = () =>
  moveToAuto({
    db,
    isReleased: true,
    sessionId: AUTO_SEED_SESSION,
    agentId: SOURCE,
    instruction: 'Test it, then review it.',
  });

const withRuntime = () => {
  const ports = makeFakePorts({ idPrefix: 'drive' });
  const runtime = createAutoRuntime({
    ctx: {
      db,
      scheduler: createAutoScheduler({ db, ownerId: 'window-main', now: Date.now }),
      ports,
      now: Date.now,
    },
    onError: (error) => {
      throw error instanceof Error ? error : new Error('runtime error');
    },
    sleep: async () => undefined,
    watchPolls: 3,
  });
  registerAutoDrivePort({ port: ({ treeId }) => runtime.drive(treeId) });
  return { ports, runtime };
};

describe('the first turn of Auto after a move', () => {
  it('claims the kickoff right after the commit, without waiting for the tick', async () => {
    const { ports, runtime } = withRuntime();

    const outcome = await move();
    await runtime.settled();

    expect(outcome.kind).toBe('adopted');
    expect(ports.autoTurns).toHaveLength(1);
    expect(ports.autoTurns[0]?.text).toContain('Test it, then review it.');
    expect(ports.autoTurns[0]?.text).toContain('Added the cap and a test.');
    if (outcome.kind === 'adopted') {
      expect(await getAutoTree({ db, treeId: outcome.treeId })).toMatchObject({
        phase: 'deciding',
      });
    }
  });

  it('leaves the kickoff for the tick when no window owns a runtime', async () => {
    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
    if (outcome.kind === 'adopted') {
      expect(await getAutoTree({ db, treeId: outcome.treeId })).toMatchObject({
        phase: 'merging',
      });
    }
  });

  it('keeps the move and reports the problem when the drive fails', async () => {
    const reportError = vi.fn<AppStore['reportError']>(async () => undefined);
    useAppStore.setState({ reportError });
    registerAutoDrivePort({ port: () => Promise.reject(new Error('lease lost')) });

    const outcome = await move();

    expect(outcome.kind).toBe('adopted');
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Auto hit a problem', sessionId: AUTO_SEED_SESSION }),
    );
    expect(await db.select('SELECT id FROM auto_trees')).toHaveLength(1);
  });

  it('does not drive a second time for a second click', async () => {
    const { ports, runtime } = withRuntime();

    await move();
    await runtime.settled();
    await move();
    await runtime.settled();

    expect(ports.autoTurns).toHaveLength(1);
  });
});
