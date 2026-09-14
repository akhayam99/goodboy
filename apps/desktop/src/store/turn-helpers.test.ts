import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionEvent,
  SessionEventId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
  runDbMigrations: vi.fn(),
}));

import { captureMaterializeRequestsFromTurn } from './turn-helpers';
import { clearMaterializationBatch } from './materializationGate';
import type { GetFn } from './slice-types';
import {
  clearMountContinuations,
  pendingMountContinuations,
  takeMountContinuation,
} from './slices/turn/mountContinuations';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const APP_ID = 'project-app' as ProjectId;
const WEB_ID = 'project-web' as ProjectId;
const DOCS_ID = 'project-docs' as ProjectId;

const project = ({ id, name }: { readonly id: ProjectId; readonly name: string }): Project =>
  ({ id, workspaceId: WORKSPACE_ID, name, rootPath: `/tmp/${name}`, kind: 'repo' }) as Project;

const app = project({ id: APP_ID, name: 'app' });
const web = project({ id: WEB_ID, name: 'web' });
const docs = project({ id: DOCS_ID, name: 'docs' });

const mount = ({ projectId, name }: { readonly projectId: ProjectId; readonly name: string }) => ({
  mountId: `mount-${projectId}` as MountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/tmp/${name}/.goodboy/worktrees/goal`,
  repoRoot: `/tmp/${name}`,
  branch: `goodboy/goal-${name}`,
});

type HarnessParams = {
  readonly goal?: string;
  readonly goalSlot?: string;
  readonly mounts?: ReadonlyArray<ReturnType<typeof mount>>;
  readonly externalTasks?: ReadonlyArray<SessionExternalTask>;
  readonly events?: ReadonlyArray<SessionEvent>;
  readonly isEventsLoaded?: boolean;
  readonly loadEventsError?: Error;
};

type RecordedEvent = {
  readonly kind: string;
  readonly payload?: Readonly<Record<string, unknown>>;
};

const harness = ({
  goal = 'ship it',
  goalSlot,
  mounts = [],
  externalTasks = [],
  events = [],
  isEventsLoaded = true,
  loadEventsError,
}: HarnessParams) => {
  const session = { id: SESSION_ID, workspaceId: WORKSPACE_ID, goal } as Session;
  let currentMounts = mounts;
  let currentEvents = events;
  let areEventsLoaded = isEventsLoaded;
  const ensureProjectMounted = vi.fn(async (input: { readonly projectId: ProjectId }) => {
    const mountedProject = [app, web, docs].find((candidate) => candidate.id === input.projectId);
    const created = mount({
      projectId: input.projectId,
      name: mountedProject?.name ?? input.projectId,
    });
    currentMounts = [...currentMounts, created];
    return {
      status: 'created' as const,
      createdMountId: created.mountId,
      mountIds: [created.mountId],
    };
  });
  const recordSessionEvent = vi.fn(async (event: RecordedEvent) => {
    currentEvents = [
      ...currentEvents,
      {
        id: `event-${currentEvents.length + 1}` as SessionEventId,
        sessionId: SESSION_ID,
        kind: event.kind,
        payload: event.payload ?? null,
        createdAt: '2026-09-14T00:00:00.000Z' as IsoDateTime,
      } as SessionEvent,
    ];
  });
  const loadSessionEvents = vi.fn(async () => {
    if (loadEventsError !== undefined) {
      throw loadEventsError;
    }
    areEventsLoaded = true;
  });
  const appendTurnEvent = vi.fn(
    (
      _agentId: AgentId,
      _sessionId: SessionId,
      _event: { readonly kind: string; readonly message: string },
    ) => undefined,
  );
  const get = (() => ({
    sessions: [session],
    projects: [app, web, docs],
    sessionProjectMounts: { [SESSION_ID]: currentMounts },
    sessionActiveProject: {},
    sessionSlots: goalSlot == null ? {} : { [SESSION_ID]: [{ key: 'goal', value: goalSlot }] },
    sessionExternalTasks: { [SESSION_ID]: externalTasks },
    sessionEvents: areEventsLoaded ? { [SESSION_ID]: currentEvents } : {},
    ensureProjectMounted,
    loadSessionEvents,
    recordSessionEvent,
    appendTurnEvent,
  })) as unknown as GetFn;
  return { get, ensureProjectMounted, recordSessionEvent, appendTurnEvent };
};

const capture = async ({
  get,
  assistantText,
}: {
  readonly get: GetFn;
  readonly assistantText: string;
}) =>
  captureMaterializeRequestsFromTurn({
    get,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    runId: RUN_ID,
    assistantText,
    boundMountId: null,
  });

type Harness = ReturnType<typeof harness>;

const proposals = (recordSessionEvent: Harness['recordSessionEvent']) =>
  recordSessionEvent.mock.calls
    .map(([event]) => event)
    .filter((event) => event.kind === 'project_materialization_proposed');

beforeEach(() => {
  clearMountContinuations();
  clearMaterializationBatch({ sessionId: SESSION_ID, batchId: RUN_ID });
});

describe('captureMaterializeRequestsFromTurn', () => {
  it('mounts on the spot while the session holds no mount at all', async () => {
    const { get, ensureProjectMounted, recordSessionEvent } = harness({});

    await capture({ get, assistantText: '<<materialize: web | patching the router>>' });

    expect(ensureProjectMounted).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      projectId: WEB_ID,
      reason: 'patching the router',
    });
    expect(proposals(recordSessionEvent)).toHaveLength(0);
    expect(pendingMountContinuations({ sessionId: SESSION_ID })).toEqual([
      expect.objectContaining({
        operationId: `materialize:${RUN_ID}:${WEB_ID}:0`,
        mountId: `mount-${WEB_ID}`,
        origin: 'materialize',
      }),
    ]);
  });

  it('does not treat a project name in the session title as authorization', async () => {
    const { get, ensureProjectMounted, recordSessionEvent } = harness({
      goal: 'fix the web router',
      mounts: [
        mount({ projectId: APP_ID, name: 'app' }),
        mount({ projectId: DOCS_ID, name: 'docs' }),
      ],
    });

    await capture({ get, assistantText: '<<materialize: web | patching the router>>' });

    expect(ensureProjectMounted).not.toHaveBeenCalled();
    expect(proposals(recordSessionEvent)).toHaveLength(1);
  });

  it('does not treat a project name in the goal slot as authorization', async () => {
    const { get, ensureProjectMounted, recordSessionEvent } = harness({
      goal: 'untitled session',
      goalSlot: 'Move the WEB router onto the new adapter',
      mounts: [
        mount({ projectId: APP_ID, name: 'app' }),
        mount({ projectId: DOCS_ID, name: 'docs' }),
      ],
    });

    await capture({ get, assistantText: '<<materialize: web | patching the router>>' });

    expect(ensureProjectMounted).not.toHaveBeenCalled();
    expect(proposals(recordSessionEvent)).toHaveLength(1);
  });

  it('authorizes a linked task by project id', async () => {
    const { get, ensureProjectMounted } = harness({
      goal: 'untitled session',
      mounts: [
        mount({ projectId: APP_ID, name: 'app' }),
        mount({ projectId: DOCS_ID, name: 'docs' }),
      ],
      externalTasks: [
        {
          sessionId: SESSION_ID,
          projectId: WEB_ID,
          provider: 'linear',
          externalId: 'ext-1',
          identifier: 'WEB-12',
          url: 'https://linear.app/task',
          title: 'Router adapter',
          createdAt: '2026-09-04T10:00:00.000Z',
        } as SessionExternalTask,
      ],
    });

    await capture({ get, assistantText: '<<materialize: web | patching the router>>' });

    expect(ensureProjectMounted).toHaveBeenCalledTimes(1);
  });

  it('adds one unnamed project while the session footprint stays inside the allowance', async () => {
    const { get, ensureProjectMounted, recordSessionEvent } = harness({
      goal: 'ship the app rename',
      mounts: [mount({ projectId: APP_ID, name: 'app' })],
    });

    await capture({ get, assistantText: '<<materialize: web | reading the router>>' });

    expect(ensureProjectMounted).toHaveBeenCalledTimes(1);
    expect(proposals(recordSessionEvent)).toHaveLength(0);
  });

  it('defers an unnamed project beyond the allowance, and tells the agent why', async () => {
    const { get, ensureProjectMounted, recordSessionEvent, appendTurnEvent } = harness({
      goal: 'ship the app rename',
      mounts: [
        mount({ projectId: APP_ID, name: 'app' }),
        mount({ projectId: DOCS_ID, name: 'docs' }),
      ],
    });

    await capture({ get, assistantText: '<<materialize: web | reading the router>>' });

    expect(ensureProjectMounted).not.toHaveBeenCalled();
    expect(proposals(recordSessionEvent)[0]?.payload).toEqual({
      projectId: WEB_ID,
      projectName: 'web',
      reason: 'reading the router',
      deferralCause: 'scope',
      agentId: AGENT_ID,
      turnRunId: RUN_ID,
    });
    const note = appendTurnEvent.mock.calls[0]?.[2];
    expect(note?.kind).toBe('decision_note');
    expect(note?.message).toBe('Mount deferred for web.');
  });

  it('caps a turn at two immediate mounts and proposes the rest', async () => {
    const { get, ensureProjectMounted, recordSessionEvent } = harness({
      goal: 'wire app, web and docs together',
      mounts: [],
    });

    await capture({
      get,
      assistantText: [
        '<<materialize: app | writing the store>>',
        '<<materialize: web | writing the router>>',
        '<<materialize: docs | writing the guide>>',
      ].join('\n'),
    });

    expect(ensureProjectMounted.mock.calls.map(([input]) => input.projectId)).toEqual([
      APP_ID,
      WEB_ID,
    ]);
    expect(proposals(recordSessionEvent).map((event) => event.payload?.['projectName'])).toEqual([
      'docs',
    ]);
  });

  it('hands out both mounts requested by two markers in the same turn', async () => {
    const { get } = harness({});

    await capture({
      get,
      assistantText: [
        '<<materialize: app | writing the store>>',
        '<<materialize: web | writing the router>>',
      ].join('\n'),
    });

    expect(takeMountContinuation({ sessionId: SESSION_ID })?.mountId).toBe(`mount-${APP_ID}`);
    expect(takeMountContinuation({ sessionId: SESSION_ID })?.mountId).toBe(`mount-${WEB_ID}`);
    expect(takeMountContinuation({ sessionId: SESSION_ID })).toBeNull();
  });

  it('deduplicates a pending proposal while still notifying the new requester', async () => {
    const pending = {
      id: 'event-pending' as SessionEventId,
      sessionId: SESSION_ID,
      kind: 'project_materialization_proposed',
      payload: {
        projectId: WEB_ID,
        projectName: 'web',
        reason: 'first request',
        agentId: 'agent-other',
        turnRunId: 'run-other',
        deferralCause: 'scope',
      },
      createdAt: '2026-09-14T00:00:00.000Z' as IsoDateTime,
    } satisfies SessionEvent;
    const { get, recordSessionEvent, appendTurnEvent } = harness({
      mounts: [
        mount({ projectId: APP_ID, name: 'app' }),
        mount({ projectId: DOCS_ID, name: 'docs' }),
      ],
      events: [pending],
    });

    await capture({ get, assistantText: '<<materialize: web | edit the router>>' });

    expect(recordSessionEvent).not.toHaveBeenCalled();
    expect(appendTurnEvent).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'decision_note',
        message: expect.stringContaining('Do not request it again in this session.'),
      }),
    );
  });

  it('keeps a completed turn successful when loading proposals fails', async () => {
    const { get, ensureProjectMounted, appendTurnEvent } = harness({
      mounts: [
        mount({ projectId: APP_ID, name: 'app' }),
        mount({ projectId: DOCS_ID, name: 'docs' }),
      ],
      isEventsLoaded: false,
      loadEventsError: new Error('event read failed'),
    });

    await expect(
      capture({ get, assistantText: '<<materialize: web | editing the router>>' }),
    ).resolves.toBeUndefined();

    expect(ensureProjectMounted).not.toHaveBeenCalled();
    expect(appendTurnEvent).toHaveBeenCalledWith(
      AGENT_ID,
      SESSION_ID,
      expect.objectContaining({
        kind: 'error',
        message: 'materialize failed for web: event read failed',
      }),
    );
  });

  it('still refuses a project this workspace does not have', async () => {
    const { get, ensureProjectMounted, recordSessionEvent } = harness({});

    await capture({ get, assistantText: '<<materialize: ghost | poking around>>' });

    expect(ensureProjectMounted).not.toHaveBeenCalled();
    expect(
      recordSessionEvent.mock.calls.some(
        ([event]) => event.kind === 'project_materialization_refused',
      ),
    ).toBe(true);
  });
});
