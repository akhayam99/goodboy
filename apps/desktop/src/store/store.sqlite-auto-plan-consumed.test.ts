import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveAutoArtifact,
  getArtifact,
  getAutoTree,
  insertArtifact,
  insertProject,
  insertSessionMount,
  insertWorkspace,
  listAutoDelegations,
  listPlansForSession,
  registerAutoArtifact,
  updatePlanBodyIfRevision,
  type Database,
} from '@goodboy/db';
import { nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type ArtifactId,
  type AutoDelegationId,
  type AutoTreeId,
  type MountId,
  type PlanWithCount,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import { AUTO_BRIDGE_EVENT, type AutoBridgeBus } from '../features/auto/bridge/autoBridgeProtocol';
import { deriveNextSteps } from '../features/suggestions/deriveNextSteps';
import type { AutoRuntime } from './runtime/auto/createAutoRuntime';
import type { BridgeOutcome, RefreshSessionArtifactsParams } from './runtime/auto/ports';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const GOAL = 'Ship the Harborline ledger export';
const PLAN_ID = brandId<ArtifactId>({ value: 'plan-ledger-export' });
const RUN_ID = 'run-auto-root';

let useAppStore: StoryStore;
let makeAutoRuntime: typeof import('./runtime/auto/makeAutoRuntime').makeAutoRuntime;
let startAutoTree: typeof import('./runtime/auto/startAutoTrees').startAutoTree;
let runAutoCommand: typeof import('./runtime/auto/runAutoCommand').runAutoCommand;
let startAutoRuntime: typeof import('./runtime/auto/startAutoRuntime').startAutoRuntime;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ makeAutoRuntime } = await import('./runtime/auto/makeAutoRuntime'));
  ({ startAutoTree } = await import('./runtime/auto/startAutoTrees'));
  ({ runAutoCommand } = await import('./runtime/auto/runAutoCommand'));
  ({ startAutoRuntime } = await import('./runtime/auto/startAutoRuntime'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await insertWorkspace({ db: await openStorySqlite(), workspace });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const routingMod = await import('../features/providers/routing');
  vi.mocked(routingMod.resolveProviderForTurn).mockResolvedValue({
    selectedProvider: 'anthropic',
    selectedModel: 'claude-sonnet-4-5',
    reason: 'preferred',
    fallbackUsed: false,
  });
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.listPlansForSession.mockImplementation((sessionId) =>
    listPlansForSession(storySqlite(), sessionId),
  );
});

type World = Readonly<{
  db: Database;
  sessionId: SessionId;
  rootAgentId: AgentId;
  runtime: AutoRuntime;
  treeId: AutoTreeId;
  announced: ReadonlyArray<RefreshSessionArtifactsParams>;
}>;

const attachLedgerCore = async ({ db, sessionId }: Pick<World, 'db' | 'sessionId'>) => {
  const project = buildStoryProject({
    id: brandId<ProjectId>({ value: 'project-ledger-core' }),
    workspaceId: workspace.id,
    name: 'ledger-core',
    kind: 'repo',
    rootPath: '/work/harborline/ledger-core',
  });
  await insertProject({ db, project });
  await insertSessionMount({
    db,
    mount: {
      id: brandId<MountId>({ value: 'mount-ledger-core' }),
      sessionId,
      projectId: project.id,
      worktreePath: '/work/harborline/ledger-core/.goodboy/worktrees/export',
      lastWorktreePath: null,
      branch: 'ak/ledger-export',
      baseBranch: 'main',
      parallelIndex: 0,
      mountName: 'ledger-core',
      repoSlug: null,
      isAttached: true,
      diskState: 'present',
      revision: 0,
      branchOrigin: 'created',
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    },
  });
  useAppStore.setState({ projects: [project] });
};

const seedPlan = async ({
  db,
  sessionId,
  rootAgentId,
  treeId,
}: Omit<World, 'runtime' | 'announced'>) => {
  await insertArtifact({
    db,
    input: {
      id: PLAN_ID,
      sessionId,
      agentId: rootAgentId,
      kind: 'plan',
      schemaVersion: 1,
      title: 'Plan for the ledger export',
      sourceFormat: 'markdown',
      sourceText: '# Plan\n\n- add the export column\n- cover it with a test\n',
      metadata: {},
    },
  });
  await registerAutoArtifact({
    db,
    artifact: {
      artifactId: PLAN_ID,
      treeId,
      kind: 'plan',
      ownerAgentId: rootAgentId,
      ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-planner' }),
      ownerRole: 'planner',
      nowMs: Date.now(),
    },
  });
};

const boot = async (): Promise<World> => {
  const db = storySqlite();
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: GOAL,
    firstAgentKind: 'generic',
  });
  const [agent] = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
  if (agent === undefined) {
    throw new Error('createSession left no agent');
  }
  await vi.waitFor(() =>
    expect(['running', 'starting']).not.toContain(
      useAppStore.getState().agentTurnState[agent.id]?.kind,
    ),
  );
  await db.execute("UPDATE agents SET kind = 'auto' WHERE id = ?", [agent.id]);
  await attachLedgerCore({ db, sessionId: session.id });
  const announced: Array<RefreshSessionArtifactsParams> = [];
  const runtime = makeAutoRuntime({
    db,
    getState: useAppStore.getState,
    announceArtifacts: async (params) => {
      announced.push(params);
    },
  });
  const started = await startAutoTree({
    ctx: runtime.ctx,
    agent: { agentId: agent.id, sessionId: session.id, workspaceId: String(workspace.id) },
    sessionCapUsd: () => 20,
    workspaceLimitUsd: async () => null,
  });
  const treeId = started.tree.id;
  await seedPlan({ db, sessionId: session.id, rootAgentId: agent.id, treeId });
  await useAppStore.getState().loadSessionPlans(session.id);
  await runtime.ctx.scheduler.claim({ treeId });
  const tree = await getAutoTree({ db, treeId });
  const moved = await runtime.ctx.scheduler.transition({
    treeId,
    expect: { phaseRev: tree?.phaseRev ?? 0, generation: 1, from: ['answering'] },
    to: 'deciding',
    patch: { activeRunId: RUN_ID, isNewTurn: true },
  });
  expect(moved.kind).toBe('applied');
  return { db, sessionId: session.id, rootAgentId: agent.id, runtime, treeId, announced };
};

type DelegateParams = {
  readonly world: World;
  readonly role: 'implementer' | 'reviewer';
};

const delegateWithPlan = ({ world, role }: DelegateParams): Promise<BridgeOutcome> =>
  runAutoCommand({
    ctx: world.runtime.ctx,
    command: {
      verb: 'delegate',
      args: {
        'request-id': `request-${role}`,
        spec: JSON.stringify({
          children: [
            {
              role,
              task: 'carry out the plan for the ledger export in ledger-core',
              reason: `the plan is ready for the ${role}`,
              mount: 'ledger-core',
              artifacts: [PLAN_ID],
            },
          ],
        }),
      },
      grant: {
        agentId: world.rootAgentId,
        treeId: world.treeId,
        generation: 1,
        workspaceId: String(workspace.id),
        sessionId: world.sessionId,
        runId: RUN_ID,
      },
    },
  });

const isPlanReadyOffered = ({ sessionId }: Pick<World, 'sessionId'>): boolean => {
  const plans = useAppStore.getState().sessionPlans[sessionId] ?? [];
  return deriveNextSteps({
    sessionId,
    workflowRuns: [],
    plans: plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      status: plan.status,
      creatorHasOpenQuestions: false,
      isOwnedByRun: false,
    })),
    consumedPlanIds: new Set(),
    openQuestionCount: 0,
    hasPullRequest: false,
    eligibleThreadCount: 0,
    projects: [],
    mountEvents: [],
  }).some((suggestion) => suggestion.kind === 'plan-ready');
};

const storePlanStatus = ({ sessionId }: Pick<World, 'sessionId'>) =>
  useAppStore.getState().sessionPlans[sessionId]?.find((plan) => plan.id === PLAN_ID)?.status;

const storeArtifactStatus = ({ sessionId }: Pick<World, 'sessionId'>) =>
  useAppStore.getState().sessionArtifacts[sessionId]?.find((artifact) => artifact.id === PLAN_ID)
    ?.status;

describe('an Auto plan handed to a child, on the real store', () => {
  it('drops the plan-ready step once a writer takes the plan, without a session switch', async () => {
    const world = await boot();
    await approveAutoArtifact({ db: world.db, artifactId: PLAN_ID, expectedRevision: 1 });
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(true);

    const outcome = await delegateWithPlan({ world, role: 'implementer' });

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true, replayed: false } });
    expect((await getArtifact({ db: world.db, artifactId: PLAN_ID }))?.status).toBe('consumed');
    expect(storePlanStatus({ sessionId: world.sessionId })).toBe('consumed');
    expect(storeArtifactStatus({ sessionId: world.sessionId })).toBe('consumed');
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(false);
    expect(world.announced).toEqual([{ sessionId: world.sessionId }]);
  });

  it('keeps the plan ready when a reviewer reads it', async () => {
    const world = await boot();
    await approveAutoArtifact({ db: world.db, artifactId: PLAN_ID, expectedRevision: 1 });

    const outcome = await delegateWithPlan({ world, role: 'reviewer' });

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true, replayed: false } });
    expect(await listAutoDelegations({ db: world.db, treeId: world.treeId })).toHaveLength(1);
    expect((await getArtifact({ db: world.db, artifactId: PLAN_ID }))?.status).toBe('active');
    expect(storePlanStatus({ sessionId: world.sessionId })).toBe('active');
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(true);
  });

  it('leaves the plan active when the admission is refused for an unapproved plan', async () => {
    const world = await boot();

    const outcome = await delegateWithPlan({ world, role: 'implementer' });

    expect(outcome).toMatchObject({ isOk: false, code: 'artifact_unapproved' });
    expect(await listAutoDelegations({ db: world.db, treeId: world.treeId })).toEqual([]);
    expect((await getArtifact({ db: world.db, artifactId: PLAN_ID }))?.status).toBe('active');
    expect(storePlanStatus({ sessionId: world.sessionId })).toBe('active');
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(true);
  });

  it('keeps the newest plans when an older refresh answers late', async () => {
    const world = await boot();
    await approveAutoArtifact({ db: world.db, artifactId: PLAN_ID, expectedRevision: 1 });
    const stale = useAppStore.getState().sessionPlans[world.sessionId] ?? [];
    let answerLate: (plans: ReadonlyArray<PlanWithCount>) => void = () => undefined;
    storySpies.listPlansForSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerLate = resolve;
        }),
    );
    const older = world.runtime.ctx.ports.refreshSessionArtifacts({ sessionId: world.sessionId });

    await delegateWithPlan({ world, role: 'implementer' });
    answerLate(stale);
    await older;

    expect(storePlanStatus({ sessionId: world.sessionId })).toBe('consumed');
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(false);
  });

  it('reports a refresh that fails and still accepts the admission', async () => {
    const world = await boot();
    await approveAutoArtifact({ db: world.db, artifactId: PLAN_ID, expectedRevision: 1 });
    storySpies.listPlansForSession.mockRejectedValueOnce(new Error('the plans could not be read'));

    const outcome = await delegateWithPlan({ world, role: 'implementer' });

    expect(outcome).toMatchObject({ isOk: true, data: { accepted: true } });
    expect((await getArtifact({ db: world.db, artifactId: PLAN_ID }))?.status).toBe('consumed');
    expect(storePlanStatus({ sessionId: world.sessionId })).toBe('active');
    const errors = await rowsOf<{ title: string }>({
      sql: "SELECT title FROM notifications WHERE kind = 'error'",
    });
    expect(errors.map((row) => row.title)).toEqual(["Couldn't refresh the plans"]);
  });
});

type Held = {
  readonly release: (plans: ReadonlyArray<PlanWithCount>) => void;
};

const holdNextPlanRead = (): Held => {
  const held: { release: (plans: ReadonlyArray<PlanWithCount>) => void } = {
    release: () => undefined,
  };
  storySpies.listPlansForSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        held.release = resolve;
      }),
  );
  return held;
};

describe('every reader of the session plans keeps only the newest answer', () => {
  it('keeps the used plan when an older session load answers after the admission', async () => {
    const world = await boot();
    await approveAutoArtifact({ db: world.db, artifactId: PLAN_ID, expectedRevision: 1 });
    const stale = useAppStore.getState().sessionPlans[world.sessionId] ?? [];
    const held = holdNextPlanRead();
    const older = useAppStore.getState().loadSessionPlans(world.sessionId);

    await delegateWithPlan({ world, role: 'implementer' });
    held.release(stale);
    await older;

    expect(storePlanStatus({ sessionId: world.sessionId })).toBe('consumed');
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(false);
  });

  it('keeps a saved plan edit when an older Auto refresh answers after it', async () => {
    const world = await boot();
    const stale = useAppStore.getState().sessionPlans[world.sessionId] ?? [];
    const held = holdNextPlanRead();
    const older = world.runtime.ctx.ports.refreshSessionArtifacts({ sessionId: world.sessionId });
    storySpies.setPlanBodyIfRevision.mockImplementationOnce((id, title, bodyMd, revision) =>
      updatePlanBodyIfRevision(storySqlite(), id, title, bodyMd, revision),
    );
    const edited = '# Plan\n\n- add the export column only\n';

    const saved = await useAppStore
      .getState()
      .updatePlanBody(world.sessionId, PLAN_ID, 'Plan for the ledger export', edited, 1);
    held.release(stale);
    await older;

    expect(saved.kind).toBe('saved');
    const plan = useAppStore
      .getState()
      .sessionPlans[world.sessionId]?.find((candidate) => candidate.id === PLAN_ID);
    expect(plan?.bodyMd).toBe(edited);
    const artifact = useAppStore
      .getState()
      .sessionArtifacts[world.sessionId]?.find((candidate) => candidate.id === PLAN_ID);
    expect(artifact?.revision).toBe(2);
  });
});

type Handler = (payload: unknown) => void;

const memoryBus = (): AutoBridgeBus => {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emit: async ({ event, payload }) => {
      for (const handler of handlers.get(event) ?? []) {
        handler(JSON.parse(JSON.stringify(payload)));
      }
    },
    listen: async ({ event, onPayload }) => {
      const listeners = handlers.get(event) ?? new Set<Handler>();
      listeners.add(onPayload);
      handlers.set(event, listeners);
      return () => {
        listeners.delete(onPayload);
      };
    },
  };
};

describe('a detached window showing the session', () => {
  it('reloads the plans when the main window says an admission changed them', async () => {
    const world = await boot();
    const bus = memoryBus();
    const stop = await startAutoRuntime({ db: world.db, isMain: false, bus });
    await world.db.execute("UPDATE session_artifacts SET status = 'consumed' WHERE id = ?", [
      PLAN_ID,
    ]);
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(true);

    await bus.emit({
      event: AUTO_BRIDGE_EVENT.artifactsChanged,
      payload: { sessionId: world.sessionId },
    });

    await vi.waitFor(() =>
      expect(storePlanStatus({ sessionId: world.sessionId })).toBe('consumed'),
    );
    expect(isPlanReadyOffered({ sessionId: world.sessionId })).toBe(false);
    stop();
  });

  it('reads nothing for a session the window does not show', async () => {
    const world = await boot();
    const bus = memoryBus();
    const stop = await startAutoRuntime({ db: world.db, isMain: false, bus });
    const reads = storySpies.listPlansForSession.mock.calls.length;

    await bus.emit({
      event: AUTO_BRIDGE_EVENT.artifactsChanged,
      payload: { sessionId: 'session-northwind' },
    });

    expect(storySpies.listPlansForSession.mock.calls.length).toBe(reads);
    stop();
  });
});
