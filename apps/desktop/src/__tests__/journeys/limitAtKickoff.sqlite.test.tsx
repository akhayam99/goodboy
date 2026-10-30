// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { insertProject, insertWorkspace, setWorkspaceValue } from '@goodboy/db';
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

let db: Awaited<ReturnType<typeof openStorySqlite>>;

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
  db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  await setWorkspaceValue({
    db,
    workspaceId: WORKSPACE_ID,
    key: 'auto.treeLimitUsd',
    value: '5',
  });
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

describe('journey: the limit chip at the kickoff', () => {
  it('gives the agent kind no limit chip, since a plain agent has no limit to enforce', async () => {
    spies();
    open();
    fireEvent.click(screen.getByRole('tab', { name: /^Agent/ }));
    const row = within(await screen.findByRole('group', { name: 'Run settings' }));

    row.getByRole('combobox', { name: 'Role' });
    expect(row.queryByRole('button', { name: /^Limit / })).toBeNull();
  });

  it('names a run, not Auto, in the popover of a workflow kind', async () => {
    spies();
    open();
    fireEvent.click(screen.getByRole('tab', { name: /^Orchestrated/ }));
    const row = within(await screen.findByRole('group', { name: 'Run settings' }));

    fireEvent.click(await row.findByRole('button', { name: 'Limit $5.00 · default' }));

    screen.getByRole('dialog', { name: 'Limit for this run' });
  });
});
