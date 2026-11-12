// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  approveAutoArtifact,
  getAutoArtifact,
  getAutoTree,
  insertArtifact,
  insertWorkspace,
  registerAutoArtifact,
  writeArtifactRevision,
} from '@goodboy/db';
import {
  brandId,
  type Agent,
  type ArtifactId,
  type AutoDelegationId,
  type AutoTreeId,
  type SessionId,
} from '@goodboy/types';
import { nextWorkspaceId } from '@goodboy/types/testing';
import { makeAutoRuntime } from '../../../store/runtime/auto/makeAutoRuntime';
import { followArtifactAnnouncements } from '../../../store/runtime/auto/followArtifactAnnouncements';
import { startAutoTree } from '../../../store/runtime/auto/startAutoTrees';
import { AUTO_BRIDGE_EVENT, type AutoBridgeBus } from '../bridge/autoBridgeProtocol';
import { tauriAutoBridgeBus } from '../bridge/tauriAutoBridgeBus';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { registerAutoUserTurnPort } from '../autoUserTurnPort';
import { AutoDockFromStore } from '../testing/AutoDockFromStore';
import { AutoPlanToolbarFromStore } from '../testing/AutoPlanToolbarFromStore';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../../store/storyHarness')).plansModuleMock(),
);

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const PLAN_ID = brandId<ArtifactId>({ value: 'plan-ledger-export' });
const APPROVE = { name: 'Approve and start Build' };
const WAITING = /^Plan v\d needs approval$/;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type World = Readonly<{
  sessionId: SessionId;
  rootAgent: Agent;
  treeId: AutoTreeId;
  told: Array<string>;
}>;

const boot = async (): Promise<World> => {
  const db = storySqlite();
  const { session } = await useAppStore.getState().createSession({
    workspaceId: workspace.id,
    goal: 'Ship the Harborline ledger export',
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
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [session.id]: (state.sessionPhaseRuns[session.id] ?? []).map((candidate) =>
        candidate.id === agent.id ? { ...candidate, kind: 'auto' } : candidate,
      ),
    },
  }));
  const runtime = makeAutoRuntime({
    db,
    getState: useAppStore.getState,
    announceArtifacts: async () => undefined,
  });
  const started = await startAutoTree({
    ctx: runtime.ctx,
    agent: { agentId: agent.id, sessionId: session.id, workspaceId: String(workspace.id) },
    sessionCapUsd: () => 20,
    workspaceLimitUsd: async () => null,
  });
  await insertArtifact({
    db,
    input: {
      id: PLAN_ID,
      sessionId: session.id,
      agentId: agent.id,
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
      treeId: started.tree.id,
      kind: 'plan',
      ownerAgentId: agent.id,
      ownerDelegationId: brandId<AutoDelegationId>({ value: 'delegation-planner' }),
      ownerRole: 'planner',
      nowMs: Date.now(),
    },
  });
  const tree = await getAutoTree({ db, treeId: started.tree.id });
  await db.execute("UPDATE auto_trees SET phase = 'answering' WHERE id = ?", [started.tree.id]);
  expect(tree).not.toBeNull();
  const told: Array<string> = [];
  registerAutoUserTurnPort({
    port: async ({ text, onQueued }) => {
      told.push(text);
      onQueued?.({ rowId: `outbox-${told.length}` });
      return 'queued';
    },
  });
  await useAppStore.getState().loadAutoTrees({ sessionId: session.id });
  const rootAgent = useAppStore.getState().sessionPhaseRuns[session.id]?.[0] ?? agent;
  return { sessionId: session.id, rootAgent, treeId: started.tree.id, told };
};

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
  stubStoryInvoke({ workspaces_with_unread: [] });
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
});

afterEach(() => {
  cleanup();
  registerAutoUserTurnPort({ port: null });
  vi.restoreAllMocks();
});

describe('approving an Auto plan, on the real store and database', () => {
  it('clears the dock bar after the dock approve', async () => {
    const world = await boot();
    const emit = vi.spyOn(tauriAutoBridgeBus, 'emit').mockResolvedValue(undefined);
    render(
      <AutoDockFromStore
        sessionId={world.sessionId}
        rootAgent={world.rootAgent}
        onOpenArtifact={vi.fn()}
      />,
    );
    await screen.findByText(WAITING);

    fireEvent.click(screen.getByRole('button', APPROVE));

    await waitFor(() => expect(screen.queryByRole('button', APPROVE)).toBeNull());
    expect(screen.queryByText(WAITING)).toBeNull();
    expect(world.told).toEqual(['Approved plan v1.']);
    expect(emit).toHaveBeenCalledWith({
      event: AUTO_BRIDGE_EVENT.artifactsChanged,
      payload: { sessionId: world.sessionId },
    });
  });

  it('tells Auto which plan the dock approved, once, however often it is pressed', async () => {
    const world = await boot();
    vi.spyOn(tauriAutoBridgeBus, 'emit').mockResolvedValue(undefined);
    const focused: Array<string | undefined> = [];
    registerAutoUserTurnPort({
      port: async ({ text, focusArtifactId, onQueued }) => {
        world.told.push(text);
        focused.push(focusArtifactId);
        onQueued?.({ rowId: `outbox-${world.told.length}` });
        return 'queued';
      },
    });
    render(
      <>
        <AutoDockFromStore
          sessionId={world.sessionId}
          rootAgent={world.rootAgent}
          onOpenArtifact={vi.fn()}
        />
        <AutoPlanToolbarFromStore sessionId={world.sessionId} artifactId={PLAN_ID} />
      </>,
    );
    await screen.findByText(WAITING);
    const toolbarApprove = within(screen.getByTestId('auto-plan-toolbar')).getByRole(
      'button',
      APPROVE,
    );
    const dockApprove = screen
      .getAllByRole('button', APPROVE)
      .find((button) => button !== toolbarApprove);
    if (dockApprove === undefined) {
      throw new Error('the dock shows no approve');
    }

    fireEvent.click(dockApprove);
    fireEvent.click(toolbarApprove);

    await waitFor(() => expect(screen.queryByText(WAITING)).toBeNull());
    expect(world.told).toEqual(['Approved plan v1.']);
    expect(focused).toEqual([PLAN_ID]);
  });

  it('drops a late answer for a version that is no longer the one shown', async () => {
    const world = await boot();
    vi.spyOn(tauriAutoBridgeBus, 'emit').mockResolvedValue(undefined);
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    const delivery: { fail: () => void; isAsked: boolean } = {
      fail: () => undefined,
      isAsked: false,
    };
    registerAutoUserTurnPort({
      port: () =>
        new Promise((resolve) => {
          delivery.isAsked = true;
          delivery.fail = () => resolve('lost');
        }),
    });
    render(
      <AutoDockFromStore
        sessionId={world.sessionId}
        rootAgent={world.rootAgent}
        onOpenArtifact={vi.fn()}
      />,
    );
    await screen.findByText(WAITING);

    fireEvent.click(screen.getByRole('button', APPROVE));
    await waitFor(() => expect(delivery.isAsked).toBe(true));
    await writeArtifactRevision({
      db: storySqlite(),
      artifactId: PLAN_ID,
      expectedRevision: 1,
      author: 'user',
      title: 'Plan for the ledger export',
      sourceText: '# Plan v2\n',
      metadata: {},
      nowMs: Date.now(),
    });
    await useAppStore.getState().loadAutoTrees({ sessionId: world.sessionId });
    await screen.findByText('Plan v2 needs approval');
    delivery.fail();

    await waitFor(() =>
      expect(screen.getByRole('button', APPROVE).hasAttribute('disabled')).toBe(false),
    );
    expect(screen.queryByText(/Auto did not hear it/)).toBeNull();
    expect(reportError).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "The plan is approved, but Auto wasn't told" }),
    );
  });

  it('shows the approved plan before the turn to Auto is delivered', async () => {
    const world = await boot();
    vi.spyOn(tauriAutoBridgeBus, 'emit').mockResolvedValue(undefined);
    const delivery: { release: () => void } = { release: () => undefined };
    registerAutoUserTurnPort({
      port: ({ onQueued }) =>
        new Promise((resolve) => {
          delivery.release = () => {
            onQueued?.({ rowId: 'outbox-held' });
            resolve('queued');
          };
        }),
    });
    render(
      <AutoDockFromStore
        sessionId={world.sessionId}
        rootAgent={world.rootAgent}
        onOpenArtifact={vi.fn()}
      />,
    );
    await screen.findByText(WAITING);

    fireEvent.click(screen.getByRole('button', APPROVE));

    await waitFor(() => expect(screen.queryByText(WAITING)).toBeNull());
    delivery.release();
  });

  it('follows an approve made in another window without a poll', async () => {
    const world = await boot();
    const listeners = new Map<string, (payload: unknown) => void>();
    const bus: AutoBridgeBus = {
      emit: async ({ event, payload }) => listeners.get(event)?.(payload),
      listen: async ({ event, onPayload }) => {
        listeners.set(event, onPayload);
        return () => undefined;
      },
    };
    const unfollow = await followArtifactAnnouncements({
      bus,
      get: useAppStore.getState,
      set: useAppStore.setState,
    });
    render(
      <AutoDockFromStore
        sessionId={world.sessionId}
        rootAgent={world.rootAgent}
        onOpenArtifact={vi.fn()}
      />,
    );
    await screen.findByText(WAITING);

    await approveAutoArtifact({ db: storySqlite(), artifactId: PLAN_ID, expectedRevision: 1 });
    await bus.emit({
      event: AUTO_BRIDGE_EVENT.artifactsChanged,
      payload: { sessionId: world.sessionId },
    });

    await waitFor(() => expect(screen.queryByText(WAITING)).toBeNull());
    unfollow();
  });

  it('clears the dock bar after the plan drawer approve', async () => {
    const world = await boot();
    render(
      <>
        <AutoDockFromStore
          sessionId={world.sessionId}
          rootAgent={world.rootAgent}
          onOpenArtifact={vi.fn()}
        />
        <AutoPlanToolbarFromStore sessionId={world.sessionId} artifactId={PLAN_ID} />
      </>,
    );
    await screen.findByText(WAITING);

    const toolbarApprove = within(screen.getByTestId('auto-plan-toolbar')).getByRole(
      'button',
      APPROVE,
    );
    fireEvent.click(toolbarApprove);

    await waitFor(() => expect(screen.queryByText(WAITING)).toBeNull());
    expect(screen.queryAllByRole('button', APPROVE)).toHaveLength(0);
    expect((await getAutoArtifact({ db: storySqlite(), artifactId: PLAN_ID }))?.approvalState).toBe(
      'approved',
    );
  });

  it('keeps the bar and reports the error when the approve is refused', async () => {
    const world = await boot();
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    render(
      <AutoDockFromStore
        sessionId={world.sessionId}
        rootAgent={world.rootAgent}
        onOpenArtifact={vi.fn()}
      />,
    );
    await screen.findByText(WAITING);
    await storySqlite().execute('UPDATE session_artifacts SET revision = 2 WHERE id = ?', [
      PLAN_ID,
    ]);

    fireEvent.click(screen.getByRole('button', APPROVE));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't approve the plan" }),
      ),
    );
    await screen.findByText('Plan v2 needs approval');
    expect(world.told).toEqual([]);
    expect((await getAutoArtifact({ db: storySqlite(), artifactId: PLAN_ID }))?.approvalState).toBe(
      'needs_approval',
    );
  });
});
