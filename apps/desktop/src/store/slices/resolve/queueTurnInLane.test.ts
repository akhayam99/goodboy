// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertResolveAttempt,
  insertResolveBatch,
  listResolveAttempts,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type { Agent, AgentId, MountId, ResolveAttempt, SessionId } from '@goodboy/types';
import { isSessionLaneBusy } from './isSessionLaneBusy';
import { queueTurnInLane } from './queueTurnInLane';
import type { GetFn } from './types';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));

const SESSION = 'session-1' as SessionId;
const PATH_A = '/repo/ledger-core';
const PATH_B = '/repo/notify-relay';
const HOLDER = 'agent-holder' as AgentId;
const RETRIER = 'agent-retrier' as AgentId;

let db: Database;
let recorded: Array<Record<string, unknown>> = [];

const resolver = ({ id }: { readonly id: AgentId }): Agent =>
  ({
    id,
    sessionId: SESSION,
    ordinal: 0,
    name: 'resolver',
    kind: 'resolver',
    status: 'running',
    doneAt: undefined,
  }) as unknown as Agent;

const attemptOf = ({
  id,
  agentId,
  phase,
  path,
  createdAt,
  threadIds,
}: {
  readonly id: string;
  readonly agentId: AgentId;
  readonly phase: ResolveAttempt['phase'];
  readonly path: string;
  readonly createdAt: number;
  readonly threadIds: ReadonlyArray<string>;
}): ResolveAttempt => ({
  id,
  sessionId: SESSION,
  agentId,
  prNumber: 7,
  threadIds,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: 'fix it',
  phase,
  mountTarget: { mountId: 'mount-1' as MountId, mountRevision: 1, worktreePath: path },
  startedAt: createdAt,
  endedAt: null,
  error: null,
  createdAt,
  batchId: 'batch-1',
  copyPath: null,
  launchChoice: null,
});

const seed = async (attempts: ReadonlyArray<ResolveAttempt>): Promise<void> => {
  for (const attempt of attempts) {
    await insertResolveAttempt({ db, attempt });
  }
};

const getOf = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): GetFn =>
  (() => ({
    sessionPhaseRuns: { [SESSION]: agents },
    agentKindOverride: {},
    sessionResolveThreads: {},
    recordResolveAttempt: async (params: Record<string, unknown>) => {
      recorded.push(params);
    },
  })) as unknown as GetFn;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  recorded = [];
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('ws-1', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-1', 'ws-1', 'Goal', 'idle', 1, 1)",
  );
  await insertResolveBatch({
    db,
    batch: {
      id: 'batch-1',
      sessionId: SESSION,
      threadIds: ['t-1', 't-2'],
      launchChoice: { provider: null, model: null, effort: null, commitStyle: null, hint: null },
      createdAt: 1,
    },
  });
});

describe('queueTurnInLane', () => {
  it('turns a retry that arrives while another agent holds the lane into a queued attempt', async () => {
    await seed([
      attemptOf({
        id: 'a-1',
        agentId: HOLDER,
        phase: 'running',
        path: PATH_A,
        createdAt: 1,
        threadIds: ['t-1'],
      }),
      attemptOf({
        id: 'a-2',
        agentId: RETRIER,
        phase: 'failed',
        path: PATH_A,
        createdAt: 2,
        threadIds: ['t-2'],
      }),
    ]);

    const isQueued = await queueTurnInLane({
      get: getOf({ agents: [resolver({ id: HOLDER }), resolver({ id: RETRIER })] }),
      sessionId: SESSION,
      agentId: RETRIER,
      content: 'try again',
      threadIds: ['t-2'],
    });

    expect(isQueued).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      phase: 'queued',
      threadIds: ['t-2'],
      instructions: 'try again',
    });
  });

  it('lets the agent that holds the lane continue its own run', async () => {
    await seed([
      attemptOf({
        id: 'a-1',
        agentId: HOLDER,
        phase: 'running',
        path: PATH_A,
        createdAt: 1,
        threadIds: ['t-1'],
      }),
    ]);

    const isQueued = await queueTurnInLane({
      get: getOf({ agents: [resolver({ id: HOLDER })] }),
      sessionId: SESSION,
      agentId: HOLDER,
      content: 'carry on',
      threadIds: undefined,
    });

    expect(isQueued).toBe(false);
    expect(recorded).toHaveLength(0);
  });

  it('does not queue behind a run on another branch', async () => {
    await seed([
      attemptOf({
        id: 'a-1',
        agentId: HOLDER,
        phase: 'running',
        path: PATH_B,
        createdAt: 1,
        threadIds: ['t-1'],
      }),
      attemptOf({
        id: 'a-2',
        agentId: RETRIER,
        phase: 'failed',
        path: PATH_A,
        createdAt: 2,
        threadIds: ['t-2'],
      }),
    ]);

    const isQueued = await queueTurnInLane({
      get: getOf({ agents: [resolver({ id: HOLDER }), resolver({ id: RETRIER })] }),
      sessionId: SESSION,
      agentId: RETRIER,
      content: 'try again',
      threadIds: ['t-2'],
    });

    expect(isQueued).toBe(false);
  });

  it('merges a second retry into the attempt already waiting in the lane', async () => {
    await seed([
      attemptOf({
        id: 'a-1',
        agentId: HOLDER,
        phase: 'running',
        path: PATH_A,
        createdAt: 1,
        threadIds: ['t-1'],
      }),
      attemptOf({
        id: 'a-2',
        agentId: RETRIER,
        phase: 'queued',
        path: PATH_A,
        createdAt: 2,
        threadIds: ['t-2'],
      }),
    ]);

    await queueTurnInLane({
      get: getOf({ agents: [resolver({ id: HOLDER }), resolver({ id: RETRIER })] }),
      sessionId: SESSION,
      agentId: RETRIER,
      content: 'and the naming',
      threadIds: ['t-3'],
    });

    expect(recorded[0]).toMatchObject({
      phase: 'queued',
      threadIds: ['t-2', 't-3'],
      instructions: 'fix it\n\nand the naming',
    });
    expect(
      (await listResolveAttempts({ db, sessionId: SESSION })).filter((a) => a.agentId === HOLDER),
    ).toHaveLength(1);
  });
});

describe('isSessionLaneBusy', () => {
  it('is busy while an agent holds a lane and free once it finished', async () => {
    await seed([
      attemptOf({
        id: 'a-1',
        agentId: HOLDER,
        phase: 'running',
        path: PATH_A,
        createdAt: 1,
        threadIds: ['t-1'],
      }),
    ]);
    const get = getOf({ agents: [resolver({ id: HOLDER })] });

    expect(await isSessionLaneBusy({ get, sessionId: SESSION })).toBe(true);

    await db.execute("UPDATE resolve_attempts SET phase = 'finished' WHERE id = 'a-1'");

    expect(await isSessionLaneBusy({ get, sessionId: SESSION })).toBe(false);
  });
});
