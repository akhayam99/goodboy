import { describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Project,
  ProjectId,
  SessionEvent,
  SessionEventId,
  SessionId,
} from '@goodboy/types';
import {
  clearMaterializationBatch,
  deferredMaterializeMessage,
  materializationGate,
  proposeMaterialization,
  runMaterializationBatch,
} from './materializationGate';
import type { GetFn } from './slice-types';

const SESSION_ID = 'session-1' as SessionId;
const WEB_ID = 'p-web' as ProjectId;

type ProjectParams = {
  readonly id: string;
  readonly name: string;
};

const project = ({ id, name }: ProjectParams): Project =>
  ({ id: id as ProjectId, name, workspaceId: 'ws-1' }) as Project;

type HarnessParams = {
  readonly mounts?: ReadonlyArray<string>;
  readonly activeProjectId?: string;
  readonly selectedProjectId?: string;
  readonly taskProjectIds?: ReadonlyArray<string>;
  readonly goal?: string;
  readonly events?: ReadonlyArray<SessionEvent>;
};

const harness = ({
  mounts = [],
  activeProjectId,
  selectedProjectId,
  taskProjectIds = [],
  goal = 'ship',
  events = [],
}: HarnessParams = {}) => {
  const recordSessionEvent = vi.fn(async () => undefined);
  const loadSessionEvents = vi.fn(async () => undefined);
  const state = {
    sessions: [
      {
        id: SESSION_ID,
        goal,
        ...(activeProjectId === undefined ? {} : { activeProjectId: activeProjectId as ProjectId }),
      },
    ],
    sessionProjectMounts: {
      [SESSION_ID]: mounts.map((projectId) => ({ projectId: projectId as ProjectId })),
    },
    sessionActiveProject:
      selectedProjectId === undefined ? {} : { [SESSION_ID]: selectedProjectId as ProjectId },
    sessionExternalTasks: {
      [SESSION_ID]: taskProjectIds.map((projectId) => ({ projectId: projectId as ProjectId })),
    },
    sessionEvents: { [SESSION_ID]: events },
    loadSessionEvents,
    recordSessionEvent,
  };
  return {
    get: (() => state) as unknown as GetFn,
    loadSessionEvents,
    recordSessionEvent,
  };
};

type ImmediateParams = {
  readonly projectIds?: ReadonlyArray<string>;
};

const immediate = ({ projectIds = [] }: ImmediateParams): ReadonlySet<ProjectId> =>
  new Set(projectIds.map((projectId) => projectId as ProjectId));

const PENDING_PROPOSAL: SessionEvent = {
  id: 'event-1' as SessionEventId,
  sessionId: SESSION_ID,
  kind: 'project_materialization_proposed',
  payload: {
    projectId: WEB_ID,
    projectName: 'web',
    reason: 'edit the router',
    deferralCause: 'scope',
  },
  createdAt: '2026-09-14T00:00:00.000Z' as IsoDateTime,
};

describe('materializationGate', () => {
  it('reports a mounted project before applying either cap', () => {
    const { get } = harness({ mounts: [WEB_ID] });

    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project({ id: WEB_ID, name: 'web' }),
        immediateProjectIds: immediate({ projectIds: ['p-api', 'p-data'] }),
      }),
    ).toEqual({ kind: 'mounted' });
  });

  it.each([
    { label: 'persisted active project', activeProjectId: WEB_ID },
    { label: 'in-memory active project', selectedProjectId: WEB_ID },
    { label: 'linked external task', taskProjectIds: [WEB_ID] },
  ])('allows an authorized project from the $label even as the third batch project', (source) => {
    const { get } = harness({ ...source, mounts: ['p-one', 'p-two'] });

    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project({ id: WEB_ID, name: 'web' }),
        immediateProjectIds: immediate({ projectIds: ['p-api', 'p-data'] }),
      }),
    ).toEqual({ kind: 'allowed' });
  });

  it('does not authorize a project through a substring in the goal', () => {
    const { get } = harness({ mounts: ['p-one', 'p-two'], goal: 'improve the rapid parser' });

    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project({ id: 'p-api', name: 'api' }),
        immediateProjectIds: immediate({}),
      }),
    ).toEqual({ kind: 'deferred', cause: 'scope' });
  });

  it('counts unauthorized mounts once per project and excludes authorized mounts', () => {
    const { get } = harness({
      mounts: ['p-one', 'p-one', 'p-active'],
      activeProjectId: 'p-active',
    });

    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project({ id: WEB_ID, name: 'web' }),
        immediateProjectIds: immediate({}),
      }),
    ).toEqual({ kind: 'allowed' });
  });

  it('defers after two distinct unauthorized project mounts', () => {
    const { get } = harness({
      mounts: ['p-one', 'p-one', 'p-two', 'p-active'],
      activeProjectId: 'p-active',
    });

    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project({ id: WEB_ID, name: 'web' }),
        immediateProjectIds: immediate({}),
      }),
    ).toEqual({ kind: 'deferred', cause: 'scope' });
  });

  it('applies the shared immediate cap to an unauthorized third project', () => {
    const { get } = harness();

    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project({ id: WEB_ID, name: 'web' }),
        immediateProjectIds: immediate({ projectIds: ['p-api', 'p-data'] }),
      }),
    ).toEqual({ kind: 'deferred', cause: 'batch' });
  });

  it('shares a batch budget across concurrent callers', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = runMaterializationBatch({
      sessionId: SESSION_ID,
      batchId: 'run-shared',
      run: async ({ budget }) => {
        budget.immediateProjectIds.add('p-api' as ProjectId);
        await firstBlocked;
        budget.immediateProjectIds.add('p-data' as ProjectId);
        return budget.immediateProjectIds.size;
      },
    });
    const second = runMaterializationBatch({
      sessionId: SESSION_ID,
      batchId: 'run-shared',
      run: async ({ budget }) => budget.immediateProjectIds.size,
    });

    releaseFirst?.();

    await expect(first).resolves.toBe(2);
    await expect(second).resolves.toBe(2);
    clearMaterializationBatch({ sessionId: SESSION_ID, batchId: 'run-shared' });
  });

  it('gives invocations without a batch id isolated budgets', async () => {
    const first = await runMaterializationBatch({
      sessionId: SESSION_ID,
      batchId: '',
      run: async ({ budget }) => {
        budget.immediateProjectIds.add('p-api' as ProjectId);
        return budget.immediateProjectIds.size;
      },
    });
    const second = await runMaterializationBatch({
      sessionId: SESSION_ID,
      run: async ({ budget }) => budget.immediateProjectIds.size,
    });

    expect(first).toBe(1);
    expect(second).toBe(0);
  });
});

describe('proposeMaterialization', () => {
  it('does not persist a second pending proposal for the same project', async () => {
    const { get, recordSessionEvent } = harness({ events: [PENDING_PROPOSAL] });

    const result = await proposeMaterialization({
      get,
      sessionId: SESSION_ID,
      project: project({ id: WEB_ID, name: 'web' }),
      reason: 'edit another router file',
      cause: 'batch',
      agentId: null,
      turnRunId: null,
    });

    expect(result).toBe('already-pending');
    expect(recordSessionEvent).not.toHaveBeenCalled();
  });

  it('records a proposal when none is pending', async () => {
    const { get, recordSessionEvent } = harness();

    const result = await proposeMaterialization({
      get,
      sessionId: SESSION_ID,
      project: project({ id: WEB_ID, name: 'web' }),
      reason: 'edit the router',
      cause: 'scope',
      agentId: null,
      turnRunId: null,
    });

    expect(result).toBe('proposed');
    expect(recordSessionEvent).toHaveBeenCalledTimes(1);
  });
});

describe('deferredMaterializeMessage', () => {
  it('stops retries when the same proposal is already pending', () => {
    const message = deferredMaterializeMessage({
      projectName: 'storefront-web',
      cause: 'scope',
      isAlreadyPending: true,
    });

    expect(message).toContain('Do not request it again in this session.');
    expect(message).toContain('Continue with work that does not require this mount');
  });
});
