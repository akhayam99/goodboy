import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, Session, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  resetStorySpies,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from './storyHarness';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-start' });
const PROJECT_ID = brandId<Parameters<typeof buildStoryProject>[0]['id'] & string>({
  value: 'project-start',
});

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID });
const project = buildStoryProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  resetStorySpies();
  stubStoryInvoke({
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
    planner_run: { stdout: '', stderr: 'no aux provider in tests', exitCode: 1 },
  });
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.getWorkspaceById.mockResolvedValue(workspace);
  storySpies.listProjectsForWorkspace.mockResolvedValue([project]);
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    sessionDrafts: {},
    openSessionDraftWorkspaceId: null,
    currentSessionId: null,
    phaseTemplates: {},
    ...connectedAnthropicState(),
  });
});

const draftOf = () => useAppStore.getState().sessionDrafts[WORKSPACE_ID];

const startRun = ({ run }: { readonly run: (session: Session) => Promise<void> }) =>
  useAppStore.getState().startSessionFromDraft({
    workspaceId: WORKSPACE_ID,
    start: { kind: 'workflow-run', goal: 'Speed up the ledger export', run },
  });

describe('story: starting a run from the new session draft', () => {
  it('the first click on a cold app starts the run', async () => {
    const workflowId = brandId<WorkflowId>({ value: 'wf_builder_cold' });
    const templateOf = (): Workflow => ({
      id: workflowId,
      workspaceId: WORKSPACE_ID,
      name: 'Speed up the ledger export',
      description: '',
      steps: [],
      isPreset: false,
      origin: 'orchestrated',
      createdAt: brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' }),
      updatedAt: brandId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' }),
    });
    storySpies.invokeWorkflowUpsert.mockImplementation(async () => templateOf());
    storySpies.invokeWorkflowList.mockResolvedValue([]);
    useAppStore.getState().openSessionDraft();

    const session = await startRun({
      run: async (created) => {
        await useAppStore.getState().savePhaseTemplate(templateOf());
        await useAppStore.getState().attachWorkflowToSession(created.id, workflowId, {
          executionMode: 'dynamic',
        });
      },
    });

    const state = useAppStore.getState();
    expect(
      state.sessions.find((candidate) => candidate.id === session.id)?.workflowRuns,
    ).toHaveLength(1);
    expect(state.currentSessionId).toBe(session.id);
    expect(state.sessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });

  it('a failed start keeps the draft, records why, and the second click starts', async () => {
    useAppStore.getState().openSessionDraft();
    useAppStore.getState().patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { workflowGoal: 'Speed up the ledger export' },
    });
    const run = vi
      .fn<(session: Session) => Promise<void>>()
      .mockRejectedValueOnce(new Error('workflow not found: wf_builder_missing'))
      .mockResolvedValue(undefined);

    await expect(startRun({ run })).rejects.toThrow('workflow not found');

    const failed = useAppStore.getState();
    expect(failed.sessions).toEqual([]);
    expect(failed.currentSessionId).toBeNull();
    expect(failed.openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
    expect(draftOf()?.workflowGoal).toBe('Speed up the ledger export');
    expect(draftOf()?.isStarting).toBe(false);
    expect(draftOf()?.startError).toContain('workflow not found');

    const session = await startRun({ run });

    const started = useAppStore.getState();
    expect(run).toHaveBeenCalledTimes(2);
    expect(started.currentSessionId).toBe(session.id);
    expect(started.sessionDrafts[WORKSPACE_ID]).toBeUndefined();
  });

  it('marks the draft as starting until the run is attached', async () => {
    useAppStore.getState().openSessionDraft();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const pending = startRun({ run: () => gate });
    await vi.waitFor(() => {
      expect(useAppStore.getState().currentSessionId).not.toBeNull();
    });
    expect(draftOf()?.isStarting).toBe(true);

    release();
    await pending;
    expect(draftOf()).toBeUndefined();
  });

  it('two fast clicks create one session and run once', async () => {
    useAppStore.getState().openSessionDraft();
    const run = vi.fn<(session: Session) => Promise<void>>().mockResolvedValue(undefined);

    const [first, second] = await Promise.all([startRun({ run }), startRun({ run })]);

    expect(first.id).toBe(second.id);
    expect(run).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().sessions).toHaveLength(1);
  });
});
