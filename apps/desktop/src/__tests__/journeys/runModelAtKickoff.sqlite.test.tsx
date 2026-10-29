// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { AgentId, ProjectId, ProviderId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import { stubProviderRouting } from '../helpers/journeyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { SessionKickoff } from '../../features/session/components/SessionKickoff';
import type { ProviderDisplayInfo } from '../../features/providers/providers';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  emptyTurnStream,
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const AGENT_ID = brandedId<AgentId>({ value: 'agent-ledger-core' });

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

const GOAL = 'Credit once per processor event id in ledger-core.';

const WORKTREE = {
  worktreePath: '/tmp/ledger-core/.goodboy/worktrees/credit-once',
  branchName: 'goodboy/credit-once',
  slug: 'credit-once',
  reused: false,
};

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

const providerOf = ({ id }: { readonly id: ProviderId }): ProviderDisplayInfo => ({
  id,
  label: id,
  error: null,
  docsUrl: 'https://example.com/docs',
  binary: id,
  capabilities: { models: [] },
  connection: 'connected',
  version: null,
  identity: null,
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  await stubProviderRouting();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  storySpies.createWorktree.mockResolvedValue(WORKTREE);
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
    providers: [providerOf({ id: 'anthropic' }), providerOf({ id: 'cursor' })],
  });
});

afterEach(() => {
  cleanup();
});

const spies = () => {
  const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT_ID);
  const attachWorkflowToSession = vi.fn<StoryState['attachWorkflowToSession']>(
    async () => undefined,
  );
  useAppStore.setState({
    spawnAgent,
    attachWorkflowToSession,
    generateWorkflowTitle: vi.fn<StoryState['generateWorkflowTitle']>(async () => undefined),
  });
  return { spawnAgent, attachWorkflowToSession };
};

const open = () => {
  useAppStore.getState().openSessionDraft();
  useAppStore.getState().patchSessionDraft({
    workspaceId: WORKSPACE_ID,
    patch: { projectIds: [PROJECT_ID] },
  });
  render(
    <ToastProvider>
      <SessionKickoff workspaceId={WORKSPACE_ID} />
    </ToastProvider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), { target: { value: GOAL } });
};

const modelChip = () => screen.getByRole('button', { name: /^Model:/ });

const pickCursor = () => {
  fireEvent.click(modelChip());
  fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
};

describe('journey: pick the model of a run at the kickoff', () => {
  it('offers Run as and Model on Auto picks, and starts the orchestrator on the model picked', async () => {
    const { attachWorkflowToSession } = spies();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Not sure? Describe it and Auto picks' }));

    fireEvent.click(screen.getByRole('button', { name: /^Run as:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflow · Orchestrated' }));
    pickCursor();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      executionMode: 'dynamic',
      orchestratorRouting: { providerId: 'cursor' },
    });
  });

  it('starts the Auto agent of a picked shape on the model picked for that run', async () => {
    const { spawnAgent } = spies();
    open();
    fireEvent.click(screen.getByRole('tab', { name: /^Agent/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Auto agent/ }));

    pickCursor();
    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({
      kindOverride: 'auto',
      provider: 'cursor',
    });
  });

  it('starts the orchestrator of a picked shape on the model picked for that run', async () => {
    const { attachWorkflowToSession } = spies();
    open();
    fireEvent.click(screen.getByRole('tab', { name: /^Workflow/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Orchestrated/ }));

    pickCursor();
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(attachWorkflowToSession).toHaveBeenCalledTimes(1));
    expect(attachWorkflowToSession.mock.calls[0]?.[2]).toMatchObject({
      orchestratorRouting: { providerId: 'cursor' },
    });
  });

  it('leaves the model to the defaults when none is picked', async () => {
    const { spawnAgent } = spies();
    open();
    fireEvent.click(screen.getByRole('tab', { name: /^Agent/ }));
    fireEvent.click(screen.getByRole('tab', { name: /^Auto agent/ }));
    expect(modelChip().getAttribute('data-run-model')).toBe('auto');

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));
    expect(spawnAgent.mock.calls[0]?.[1]).not.toHaveProperty('provider');
  });
});
