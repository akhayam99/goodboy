// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import { stubProviderRouting } from '../helpers/journeyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { selectSessionDraft } from '../../store/slices/sessionDraft/selectSessionDraft';
import { PickedIssue } from '../../features/session/components/SessionKickoff/PickedIssue';
import type { IssueCandidate } from '../../features/integrations/fetchIssueCandidates';
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

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

const ISSUE: IssueCandidate = {
  provider: 'linear',
  externalId: 'issue-412',
  identifier: 'HBL-412',
  title: 'Retried webhooks post a second credit',
  url: 'https://linear.app/harborline/issue/HBL-412',
  goal: '[HBL-412] Retried webhooks post a second credit\n\nThe processor redelivers an event.',
  body: 'The processor redelivers an event.',
  branchSlug: 'retried-webhooks-post-a-second-credit',
};

const INSTRUCTIONS = 'Credit once per processor event id in ledger-core.';

let useAppStore: StoryStore;

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
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
});

afterEach(() => {
  cleanup();
});

const draft = () =>
  selectSessionDraft({ state: useAppStore.getState(), workspaceId: WORKSPACE_ID });

const renderPicked = () =>
  render(
    <ToastProvider>
      <PickedIssue
        workspaceId={WORKSPACE_ID}
        candidates={draft().pickedIssues}
        onRemove={() => undefined}
        onAddAnother={() => undefined}
      />
    </ToastProvider>,
  );

const pickIssue = () =>
  useAppStore.getState().patchSessionDraft({
    workspaceId: WORKSPACE_ID,
    patch: {
      choice: 'task',
      pickedIssues: [ISSUE],
      hasPickedStep: true,
      projectIds: [PROJECT_ID],
    },
  });

const WORKTREE = {
  worktreePath: '/tmp/ledger-core/.goodboy/worktrees/hbl-412',
  branchName: 'goodboy/hbl-412',
  slug: 'hbl-412',
  reused: false,
};

const sessionRows = () =>
  rowsOf<{ id: string; goal: string }>({ sql: 'SELECT id, goal FROM sessions' });

describe('journey: start a session from an issue', () => {
  it('picks the issue, edits the brief, starts, and leaves a linked session with a running agent', async () => {
    useAppStore.getState().openSessionDraft();
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
    expect(draft().pickedIssues).toEqual([]);

    pickIssue();
    expect(draft().pickedIssues.map((issue) => issue.identifier)).toEqual(['HBL-412']);

    renderPicked();
    expect(screen.getByRole('region', { name: 'Brief from HBL-412' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      ISSUE.title,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Ask an agent' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent instructions' }), {
      target: { value: INSTRUCTIONS },
    });
    expect(await sessionRows()).toEqual([]);

    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    storySpies.createWorktree.mockImplementation(async () => {
      await held;
      return WORKTREE;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start from HBL-412' }));

    await waitFor(() => expect(draft().isStarting).toBe(true));
    expect(draft().startError).toBeNull();
    await waitFor(() => expect(screen.getByText('Starting…')).toBeDefined());
    expect(storySpies.runTurn).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1));
    const session = useAppStore.getState().sessions[0];
    expect(await sessionRows()).toEqual([{ id: session?.id, goal: session?.goal }]);
    expect(
      await rowsOf<{ key: string; value: string }>({
        sql: "SELECT key, value FROM context_slots WHERE session_id = ? AND key = 'goal'",
        params: [session?.id],
      }),
    ).toEqual([{ key: 'goal', value: INSTRUCTIONS }]);
    expect(
      await rowsOf<{ provider: string; identifier: string }>({
        sql: 'SELECT provider, identifier FROM session_external_tasks WHERE session_id = ?',
        params: [session?.id],
      }),
    ).toEqual([{ provider: 'linear', identifier: 'HBL-412' }]);
    expect(
      await rowsOf<{ kind: string; status: string }>({
        sql: 'SELECT kind, status FROM agents WHERE session_id = ?',
        params: [session?.id],
      }),
    ).toEqual([{ kind: 'implementer', status: expect.any(String) }]);
    await waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledOnce());
    await waitFor(async () =>
      expect(
        await rowsOf<{ role: string; content: string }>({
          sql: 'SELECT role, content FROM messages WHERE role = ?',
          params: ['user'],
        }),
      ).toEqual([{ role: 'user', content: INSTRUCTIONS }]),
    );
    expect(
      await rowsOf<{ project_id: string; branch: string }>({
        sql: 'SELECT project_id, branch FROM session_worktrees WHERE session_id = ?',
        params: [session?.id],
      }),
    ).toEqual([{ project_id: PROJECT_ID, branch: 'goodboy/hbl-412' }]);
    expect(draft().pickedIssues).toEqual([]);
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBeNull();
    await waitFor(() => expect(screen.getAllByText('Session started')).toHaveLength(1));
  });

  it('keeps the draft and shows the error when the mount fails, then starts on retry', async () => {
    useAppStore.getState().openSessionDraft();
    pickIssue();
    renderPicked();
    fireEvent.click(screen.getByRole('tab', { name: 'Ask an agent' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent instructions' }), {
      target: { value: INSTRUCTIONS },
    });
    storySpies.createWorktree.mockRejectedValueOnce(new Error('git worktree add failed'));

    fireEvent.click(screen.getByRole('button', { name: 'Start from HBL-412' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('git worktree add failed'),
    );
    expect(draft().startError).toContain('git worktree add failed');
    expect(draft().isStarting).toBe(false);
    expect(draft().pickedIssues.map((issue) => issue.identifier)).toEqual(['HBL-412']);
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
    expect(useAppStore.getState().sessions).toEqual([]);
    expect(await sessionRows()).toEqual([]);
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(screen.queryByText('Session started')).toBeNull();

    storySpies.createWorktree.mockResolvedValue(WORKTREE);
    fireEvent.click(screen.getByRole('button', { name: 'Start from HBL-412' }));

    await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1));
    expect(await sessionRows()).toHaveLength(1);
    expect(draft().startError).toBeNull();
    await waitFor(() => expect(storySpies.runTurn).toHaveBeenCalledOnce());
    expect(draft().pickedIssues).toEqual([]);
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBeNull();
  });
});
