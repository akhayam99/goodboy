import { describe, expect, it, vi } from 'vitest';
import { getAgentById, listAutoDelegations } from '@goodboy/db';
import { AUTO_SEED_ROOT, AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type ProviderRunId,
  type SessionMountView,
} from '@goodboy/types';
import { createRealAutoPorts, type RealAutoPortsDeps } from './createRealAutoPorts';
import type { StartChildTurnParams } from './ports';
import type { SendTurnInput, SendTurnResult } from '../turn/types';
import { batchInput, childInput, makeAutoWorld, WORLD_TREE } from './testing/autoWorld';

const NOW = 1_700_000_000_000;

const VIEW: SessionMountView = {
  id: brandId<MountId>({ value: 'mount-ledger-core' }),
  sessionId: AUTO_SEED_SESSION,
  projectId: brandId<ProjectId>({ value: 'project-ledger-core' }),
  worktreePath: '/work/harborline/ledger-core',
  lastWorktreePath: null,
  branch: 'ak/ledger-export',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'ledger-core',
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 3,
  createdAt: new Date(NOW).toISOString() as IsoDateTime,
  updatedAt: new Date(NOW).toISOString() as IsoDateTime,
  repoRoot: '/work/harborline/ledger-core',
};

const worldWithPorts = async (patch: Partial<RealAutoPortsDeps> = {}) => {
  const world = await makeAutoWorld({ agentIds: ['agent-implementer'] });
  const refreshAgents = vi.fn(async () => undefined);
  const sendTurn = vi.fn(async (_input: SendTurnInput): Promise<SendTurnResult> => ({
    blockedOverBudget: false,
  }));
  const deps: RealAutoPortsDeps = {
    db: world.db,
    getState: () => {
      throw new Error('the state is not needed here');
    },
    sendTurn,
    cancelTurnConfirmed: vi.fn(async () => ({ outcome: 'exited' as const, exitedAt: null })),
    loadSessionMounts: vi.fn(async () => [VIEW]),
    refreshAgents,
    lookupDeliveryRun: vi.fn(async () => null),
    worktreeSnapshot: vi.fn(async () => ({ head: 'abc123', entries: [], isPartial: false })),
    revokeTreeCapabilities: vi.fn(async () => 1),
    listLiveRunIds: vi.fn(async () => new Set(['run-live'])),
    watchYield: vi.fn(),
    sleep: async () => undefined,
    nowMs: () => NOW,
    newId: () => 'id-1',
    ...patch,
  };
  return { world, deps, ports: createRealAutoPorts(deps), refreshAgents, sendTurn };
};

const childTurn = (
  onEnded: StartChildTurnParams['onEnded'],
  patch: Partial<StartChildTurnParams> = {},
): StartChildTurnParams => ({
  treeId: WORLD_TREE,
  generation: 1,
  delegationId: brandId<StartChildTurnParams['delegationId']>({ value: 'delegation-impl' }),
  attemptId: brandId<StartChildTurnParams['attemptId']>({ value: 'attempt-impl' }),
  childAgentId: brandId<AgentId>({ value: 'agent-implementer' }),
  sessionId: AUTO_SEED_SESSION,
  role: 'implementer',
  text: 'add the export',
  mountTarget: {
    mountId: 'mount-ledger-core',
    mountRevision: 3,
    worktreePath: '/work/harborline/ledger-core',
  },
  runId: 'run-impl-1',
  captureMode: 'new',
  onEnded,
  ...patch,
});

describe('the ports of Auto on the real store', () => {
  it('lists the mounts of a conversation the way mount picking reads them', async () => {
    const { ports } = await worldWithPorts();

    expect(await ports.loadMounts({ sessionId: AUTO_SEED_SESSION })).toEqual([
      {
        id: 'mount-ledger-core',
        mountName: 'ledger-core',
        branch: 'ak/ledger-export',
        projectId: 'project-ledger-core',
        worktreePath: '/work/harborline/ledger-core',
        revision: 3,
        isAttached: true,
        diskState: 'present',
      },
    ]);
  });

  it('starts a child turn with its role, frozen mount target and attempt id as delivery id', async () => {
    const { ports, sendTurn, deps } = await worldWithPorts();
    vi.mocked(deps.lookupDeliveryRun).mockResolvedValue({ runId: 'run-impl-1', isLive: true });

    const outcome = await ports.startChildTurn(childTurn(vi.fn()));

    expect(outcome).toEqual({ kind: 'started', runId: 'run-impl-1' });
    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: AUTO_SEED_SESSION,
        agentId: 'agent-implementer',
        content: 'add the export',
        origin: 'delegation',
        confinedRole: 'implementer',
        captureMode: 'new',
        runId: 'run-impl-1',
        deliveryId: 'attempt-impl',
        mountTarget: {
          mountId: 'mount-ledger-core',
          mountRevision: 3,
          worktreePath: '/work/harborline/ledger-core',
        },
      }),
    );
    expect(sendTurn.mock.calls[0]?.[0]).not.toHaveProperty('autoTree');
  });

  it('reports the end of a child with its text, exit, cost and files', async () => {
    const onEnded = vi.fn();
    const { ports, sendTurn, deps } = await worldWithPorts();
    vi.mocked(deps.lookupDeliveryRun).mockResolvedValue({ runId: 'run-impl-1', isLive: true });
    await ports.startChildTurn(childTurn(onEnded));
    const input = sendTurn.mock.calls[0]?.[0];

    input?.onSettled?.({
      runId: brandId<ProviderRunId>({ value: 'run-impl-1' }),
      assistantText: 'Added the export.',
      hasFailed: false,
      wasCancelled: false,
      filesTouched: ['src/export.ts'],
    });
    await vi.waitFor(() => expect(onEnded).toHaveBeenCalledTimes(1));

    expect(onEnded).toHaveBeenCalledWith(
      expect.objectContaining({
        delegationId: 'delegation-impl',
        attemptId: 'attempt-impl',
        runId: 'run-impl-1',
        childAgentId: 'agent-implementer',
        assistantText: 'Added the export.',
        exit: 'ok',
        filesTouched: ['src/export.ts'],
      }),
    );
  });

  it('turns a writer lease that stayed busy into lease_busy and anything else into kickoff_failed', async () => {
    const busy = await worldWithPorts({
      sendTurn: vi.fn(async () => ({ blockedOverBudget: false, isWriterLeaseDenied: true })),
    });
    const broken = await worldWithPorts({
      sendTurn: vi.fn(async () => {
        throw new Error('the provider is not connected');
      }),
    });

    expect(await busy.ports.startChildTurn(childTurn(vi.fn()))).toMatchObject({
      kind: 'refused',
      reason: 'lease_busy',
    });
    expect(await broken.ports.startChildTurn(childTurn(vi.fn()))).toMatchObject({
      kind: 'refused',
      reason: 'kickoff_failed',
      message: 'the provider is not connected',
    });
  });

  it('cancels a run with the confirmed cancel and tells what happened', async () => {
    const { ports, deps } = await worldWithPorts();
    vi.mocked(deps.cancelTurnConfirmed).mockResolvedValue({
      outcome: 'still_running',
      exitedAt: null,
    });

    const outcome = await ports.cancelRun({
      sessionId: AUTO_SEED_SESSION,
      agentId: brandId<AgentId>({ value: 'agent-implementer' }),
    });

    expect(outcome).toEqual({ outcome: 'still_running' });
    expect(deps.cancelTurnConfirmed).toHaveBeenCalledWith({
      sessionId: AUTO_SEED_SESSION,
      agentId: 'agent-implementer',
      reason: 'user',
    });
  });

  it('knows a live run from a finished one and revokes the tokens of a tree', async () => {
    const { ports, deps } = await worldWithPorts();

    expect(await ports.isRunLive({ runId: 'run-live' })).toBe(true);
    expect(await ports.isRunLive({ runId: 'run-gone' })).toBe(false);
    await ports.revokeCapabilities({ treeId: WORLD_TREE });
    expect(deps.revokeTreeCapabilities).toHaveBeenCalledWith({ treeId: WORLD_TREE });
  });

  it('reads the snapshot of a mount through the worktree command', async () => {
    const { ports, deps } = await worldWithPorts();

    expect(await ports.readMountSnapshot({ worktreePath: '/work/harborline/ledger-core' })).toEqual(
      { head: 'abc123', entries: [], isPartial: false },
    );
    expect(deps.worktreeSnapshot).toHaveBeenCalledWith({
      worktreePath: '/work/harborline/ledger-core',
    });
  });

  it('creates the agent of a delegation once, with the kind of its role, and refreshes the list', async () => {
    const { world, ports, refreshAgents } = await worldWithPorts();
    await world.scheduler.admit(
      batchInput({
        children: [
          childInput({ key: 'impl', role: 'investigator', agentId: 'agent-investigator' }),
        ],
      }),
    );
    const [delegation] = await listAutoDelegations({ db: world.db, treeId: WORLD_TREE });
    if (delegation === undefined) {
      throw new Error('a delegation was expected');
    }
    const params = {
      delegation,
      sessionId: AUTO_SEED_SESSION,
      parentAgentId: AUTO_SEED_ROOT,
    };

    await ports.ensureChildAgent(params);
    await ports.ensureChildAgent(params);

    const agent = await getAgentById(world.db, delegation.childAgentId);
    expect(agent).toMatchObject({ kind: 'debugger', parentAgentId: AUTO_SEED_ROOT });
    expect(refreshAgents).toHaveBeenCalledTimes(1);
  });
});
