// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react';
import { insertProject, insertWorkspace } from '@goodboy/db';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import { bindAgentRowsToSqlite, stubProviderRouting } from '../helpers/journeyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { resetWorktreeStatusCache } from '../../store/runtime/worktreeStatuses/cache';
import { CentralColumn } from '../../features/session/components/SessionOverviewPane/CentralColumn';
import { WorkTimeProvider } from '../../features/workTreeModel/WorkTimeProvider';
import { SessionKickoff } from '../../features/session/components/SessionKickoff';
import { CreatePrPanel } from '../../features/integrations/github/components/PullRequest/CreatePrPanel';
import { pickIssue } from '../../features/session/pickIssue';
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

const WORKTREE = {
  worktreePath: '/tmp/ledger-core/.goodboy/worktrees/hbl-412',
  branchName: 'goodboy/hbl-412',
  slug: 'hbl-412',
  reused: false,
};

const REPO_SLUG = 'harborline/ledger-core';
const PR_URL = 'https://github.com/harborline/ledger-core/pull/418';
const ASK = '@Implementer Credit once per processor event id in ledger-core.';

type PrState = 'OPEN' | 'MERGED';
type GhPayload = { readonly args: ReadonlyArray<string> };

let useAppStore: StoryStore;
let prState: PrState;
let hasCreatedPr: boolean;
let linearState: { name: string; type: string };
let linearWrites: Array<string>;
let refusal: string | null;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const rawPr = () => ({
  number: 418,
  title: ISSUE.title,
  url: PR_URL,
  state: prState,
  isDraft: false,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: WORKTREE.branchName,
  reviewDecision: 'APPROVED',
  statusCheckRollup: [],
  updatedAt: '2026-10-16T09:00:00Z',
  body: '',
  autoMergeRequest: null,
  headRefOid: 'abc1234',
  mergedAt: prState === 'MERGED' ? '2026-10-16T09:30:00Z' : null,
  author: { login: 'mara' },
});

const answerGh = ({ args }: GhPayload) => {
  if (args[0] === 'repo' && args.includes('defaultBranchRef')) {
    return { stdout: 'main', stderr: '', exitCode: 0 };
  }
  if (args[0] === 'repo') {
    return { stdout: REPO_SLUG, stderr: '', exitCode: 0 };
  }
  if (args[0] === 'api') {
    return { stdout: 'main\n', stderr: '', exitCode: 0 };
  }
  if (args[0] === 'pr' && args[1] === 'create' && refusal !== null) {
    return { stdout: '', stderr: refusal, exitCode: 1 };
  }
  if (args[0] === 'pr' && args[1] === 'create') {
    hasCreatedPr = true;
    return { stdout: `${PR_URL}\n`, stderr: '', exitCode: 0 };
  }
  if (args[0] === 'pr' && args[1] === 'list') {
    return {
      stdout: JSON.stringify(hasCreatedPr ? [rawPr()] : []),
      stderr: '',
      exitCode: 0,
    };
  }
  return { stdout: '', stderr: 'not stubbed', exitCode: 1 };
};

beforeEach(async () => {
  await resetStoryStore();
  prState = 'OPEN';
  hasCreatedPr = false;
  refusal = null;
  linearState = { name: 'In Progress', type: 'started' };
  linearWrites = [];
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    gh_run: answerGh,
    git_push: { stdout: '', stderr: '', exitCode: 0 },
    git_remote_names: ['origin'],
    linear_fetch_issue: () => ({ id: ISSUE.externalId, state: linearState }),
    linear_fetch_team_states: [
      { id: 'state-progress', name: 'In Progress', type: 'started', position: 2 },
      { id: 'state-done', name: 'Done', type: 'completed', position: 3 },
    ],
    linear_update_issue_state: (args: unknown) => {
      const stateId =
        typeof args === 'object' && args !== null && 'stateId' in args ? String(args.stateId) : '';
      linearWrites.push(stateId);
      linearState =
        stateId === 'state-done'
          ? { name: 'Done', type: 'completed' }
          : { name: 'In Progress', type: 'started' };
      return linearState;
    },
  });
  await stubProviderRouting();
  bindAgentRowsToSqlite();
  storySpies.runTurn.mockImplementation(() => emptyTurnStream());
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  storySpies.createWorktree.mockResolvedValue(WORKTREE);
  storySpies.worktreeStatus.mockRejectedValue(new Error('git status is not available'));
  resetWorktreeStatusCache();
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

const startFromIssue = async () => {
  useAppStore.getState().openSessionDraft();
  render(
    <ToastProvider>
      <SessionKickoff workspaceId={WORKSPACE_ID} />
    </ToastProvider>,
  );
  pickIssue({ workspaceId: WORKSPACE_ID, candidate: ISSUE });
  useAppStore.getState().patchSessionDraft({
    workspaceId: WORKSPACE_ID,
    patch: { projectIds: [PROJECT_ID] },
  });
  const field = await screen.findByRole('textbox', { name: 'Goal' });
  await waitFor(() => expect(field).toHaveProperty('value', ISSUE.goal));
  fireEvent.change(field, { target: { value: ASK } });
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  await waitFor(() => expect(useAppStore.getState().sessions).toHaveLength(1));
  const [session] = useAppStore.getState().sessions;
  if (session === undefined) {
    throw new Error('the session was not created');
  }
  sessionId = session.id;
  cleanup();
};

const agentRows = () =>
  rowsOf<{ kind: string; status: string }>({
    sql: 'SELECT kind, status FROM agents WHERE session_id = ?',
    params: [sessionId],
  });

const taskRows = () =>
  rowsOf<{ provider: string; identifier: string; branch: string | null }>({
    sql: 'SELECT provider, identifier, branch FROM session_external_tasks WHERE session_id = ?',
    params: [sessionId],
  });

const linkRows = () =>
  rowsOf<{
    provider: string;
    repo_slug: string;
    pr_number: number;
    head_branch: string;
    url: string;
    state: string;
    merged_at: number | null;
  }>({
    sql: `SELECT link.provider, link.repo_slug, link.pr_number, link.head_branch, link.url,
            link.state, link.merged_at
          FROM mount_pr_links link
          JOIN session_worktrees mount ON mount.id = link.mount_id
          WHERE mount.session_id = ?`,
    params: [sessionId],
  });

const eventKinds = async () =>
  (
    await rowsOf<{ kind: string }>({
      sql: 'SELECT kind FROM session_events WHERE session_id = ? ORDER BY created_at, rowid',
      params: [sessionId],
    })
  ).map((row) => row.kind);

const prCreatedPayloads = async () =>
  (
    await rowsOf<{ payload_json: string }>({
      sql: "SELECT payload_json FROM session_events WHERE session_id = ? AND kind = 'pr_created'",
      params: [sessionId],
    })
  ).map((row) => JSON.parse(row.payload_json));

const mountOf = () => {
  const [mount] = useAppStore.getState().sessionMounts[sessionId] ?? [];
  if (mount === undefined) {
    throw new Error('the session has no mount');
  }
  return mount;
};

const nextCardOf = (view: RenderResult): HTMLElement | null =>
  view.container.querySelector<HTMLElement>('[data-overview-card="next"]');

const nextCard = (view: RenderResult): HTMLElement => {
  const card = nextCardOf(view);
  if (card === null) {
    throw new Error('the Next card is not drawn');
  }
  return card;
};

const showNext = (view: RenderResult): string => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  view.rerender(
    <ToastProvider>
      <WorkTimeProvider sessionId={session.id} workspaceId={session.workspaceId}>
        <CentralColumn session={session} onLeadChange={() => undefined} />
      </WorkTimeProvider>
    </ToastProvider>,
  );
  return nextCardOf(view)?.textContent ?? '';
};

const isGhPayload = (value: unknown): value is GhPayload =>
  typeof value === 'object' && value !== null && 'args' in value && Array.isArray(value.args);

const ghCalls = ({ verb }: { readonly verb: string }) =>
  storySpies.tauriInvoke.mock.calls.filter(([command, payload]) => {
    if (command !== 'gh_run' || !isGhPayload(payload)) {
      return false;
    }
    return payload.args[0] === 'pr' && payload.args[1] === verb;
  });

describe('journey: from a task to a merged pull request', () => {
  it('links the task, opens the pull request, records its identity and follows the merge', async () => {
    await startFromIssue();

    expect(await taskRows()).toEqual([
      { provider: 'linear', identifier: 'HBL-412', branch: WORKTREE.branchName },
    ]);
    await waitFor(async () =>
      expect(await agentRows()).toEqual([{ kind: 'implementer', status: 'completed' }]),
    );
    await useAppStore.getState().loadSessionMounts({ sessionId });
    expect(mountOf()).toMatchObject({ branch: WORKTREE.branchName, isAttached: true });

    const view = render(<ToastProvider>{null}</ToastProvider>);
    expect(showNext(view)).toBe('');
    expect(await linkRows()).toEqual([]);

    const created = render(
      <ToastProvider>
        <CreatePrPanel
          sessionId={sessionId}
          mountId={mountOf().id}
          defaultTitle={ISSUE.title}
          onCreated={() => undefined}
        />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /pull request$/ }));
    await waitFor(() => expect(ghCalls({ verb: 'create' })).toHaveLength(1));
    created.unmount();

    await waitFor(async () => expect(await linkRows()).toHaveLength(1));
    expect(await linkRows()).toEqual([
      {
        provider: 'github',
        repo_slug: REPO_SLUG,
        pr_number: 418,
        head_branch: WORKTREE.branchName,
        url: PR_URL,
        state: 'approved',
        merged_at: null,
      },
    ]);
    expect(await eventKinds()).toContain('pr_created');
    expect(await prCreatedPayloads()).toEqual([
      expect.objectContaining({ url: PR_URL, branch: WORKTREE.branchName }),
    ]);
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith(
      'git_push',
      expect.objectContaining({ cwd: WORKTREE.worktreePath }),
    );

    await act(async () => {
      await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
    });
    expect(useAppStore.getState().mountGithub[mountOf().id]?.pr).toMatchObject({
      number: 418,
      state: 'approved',
    });
    expect(showNext(view)).not.toContain('merged');

    prState = 'MERGED';
    await useAppStore.getState().refreshSessionPr(sessionId, { force: true });

    await vi.waitFor(() => expect(showNext(view)).toContain('Remove the ledger-core worktree'));
    expect(await linkRows()).toEqual([
      expect.objectContaining({ pr_number: 418, state: 'merged', merged_at: expect.any(Number) }),
    ]);
    expect(showNext(view)).toContain('Archive this session');
  });

  it('offers to move HBL-412 to Done only after the merge, moves it on one click and takes it back with Undo', async () => {
    await startFromIssue();
    await useAppStore.getState().loadSessionMounts({ sessionId });
    const view = render(<ToastProvider>{null}</ToastProvider>);
    await act(async () => {
      await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
    });
    expect(showNext(view)).not.toContain('Move HBL-412');

    hasCreatedPr = true;
    prState = 'OPEN';
    await act(async () => {
      await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
    });
    expect(showNext(view)).not.toContain('Move HBL-412');
    expect(linearWrites).toEqual([]);

    prState = 'MERGED';
    await act(async () => {
      await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
    });
    await vi.waitFor(() => expect(showNext(view)).toContain('Move HBL-412 to Done'));
    expect(linearWrites).toEqual([]);

    showNext(view);
    fireEvent.click(within(nextCard(view)).getByRole('button', { name: /^Move/ }));

    await vi.waitFor(() => expect(linearWrites).toEqual(['state-done']));
    await vi.waitFor(() => expect(showNext(view)).not.toContain('Move HBL-412'));
    expect(useAppStore.getState().trackerMoveSettled[sessionId]).toEqual([
      `linear:${ISSUE.externalId}`,
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await vi.waitFor(() => expect(linearWrites).toEqual(['state-done', 'state-progress']));
    expect(showNext(view)).not.toContain('Move HBL-412');
  });

  it('shows no move when HBL-412 is already done in Linear', async () => {
    await startFromIssue();
    await useAppStore.getState().loadSessionMounts({ sessionId });
    const view = render(<ToastProvider>{null}</ToastProvider>);
    hasCreatedPr = true;
    prState = 'MERGED';
    linearState = { name: 'Done', type: 'completed' };

    await act(async () => {
      await useAppStore.getState().refreshSessionPr(sessionId, { force: true });
    });
    await vi.waitFor(() => expect(showNext(view)).toContain('Archive this session'));

    expect(showNext(view)).not.toContain('Move HBL-412');
    expect(linearWrites).toEqual([]);
  });

  it('keeps the session without a link when the host refuses the pull request, and a retry opens it', async () => {
    await startFromIssue();
    await useAppStore.getState().loadSessionMounts({ sessionId });
    refusal = 'GraphQL: No commits between main and goodboy/hbl-412';
    const created = render(
      <ToastProvider>
        <CreatePrPanel
          sessionId={sessionId}
          mountId={mountOf().id}
          defaultTitle={ISSUE.title}
          onCreated={() => undefined}
        />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /pull request$/ }));

    await waitFor(() =>
      expect(created.container.querySelector('[role="alert"]')?.textContent).toContain(
        "Couldn't open the pull request",
      ),
    );
    expect(await linkRows()).toEqual([]);
    expect(await eventKinds()).not.toContain('pr_created');
    expect(hasCreatedPr).toBe(false);

    refusal = null;
    fireEvent.click(screen.getByRole('button', { name: /pull request$/ }));

    await waitFor(async () => expect(await linkRows()).toHaveLength(1));
    expect(await eventKinds()).toContain('pr_created');
    expect(ghCalls({ verb: 'create' })).toHaveLength(2);
  });
});
