import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Project, SessionId, TaskModelPreferences, WorkspaceId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import type { GitlabMergeRequest } from '../../client';
import { CommandError } from '../../../../../shared/lib/invokeCommand';

type SpawnAgent = (
  sessionId: SessionId,
  args: Readonly<Record<string, unknown>>,
) => Promise<string>;

type Store = {
  readonly sessions: ReadonlyArray<{
    id: SessionId;
    goal: string;
    workspaceId: string;
    providerPreference: { defaultProvider: 'anthropic'; allowTurnOverride: false };
  }>;
  readonly currentWorkspaceId: null;
  readonly currentSessionId: null;
  readonly openSessionDraftWorkspaceId: null;
  readonly appStudio: null;
  readonly drawer: null;
  readonly sessionPhaseRuns: Record<string, never>;
  readonly agentKindOverride: Record<string, never>;
  sessionGitlabMr: Record<string, unknown>;
  readonly sessionBranches: Record<string, string>;
  projects: ReadonlyArray<Project>;
  readonly refreshSessionMr: ReturnType<typeof vi.fn>;
  readonly createMrForSession: ReturnType<typeof vi.fn>;
  readonly mergeMrForSession: ReturnType<typeof vi.fn>;
  readonly spawnAgent: ReturnType<typeof vi.fn<SpawnAgent>>;
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly loadAgentTranscript: ReturnType<typeof vi.fn>;
  readonly reportError: ReturnType<typeof vi.fn>;
  workspaceOverrides: Record<string, { readonly taskModels: TaskModelPreferences | null }>;
  readonly providers: ReadonlyArray<{ readonly id: string; readonly connection: 'connected' }>;
};

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

type MrParams = {
  readonly mergeStatus?: GitlabMergeRequest['mergeStatus'];
  readonly webUrl?: string;
  readonly title?: string;
  readonly draft?: boolean;
};

const h = vi.hoisted(() => ({
  gitlabMergeMr: vi.fn(async () => undefined),
  gitlabProjectMergeMethods: vi.fn(async () => ({
    mergeMethod: 'merge',
    squashOption: 'default_off',
    onlyAllowMergeIfPipelineSucceeds: false,
  })),
  gitlabListMrDiscussions: vi.fn(async () => [] as ReadonlyArray<unknown>),
  gitlabMrApprovalState: vi.fn(async () => null),
  gitlabUpdateMrState: vi.fn<(params: Readonly<Record<string, unknown>>) => Promise<unknown>>(),
  showToast:
    vi.fn<(params: { readonly kind: string; readonly message: string } & ToastOptions) => void>(),
  store: {
    sessions: [
      {
        id: 'session-3' as SessionId,
        goal: 'Prepare the GitLab release',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      },
    ],
    currentWorkspaceId: null,
    currentSessionId: null,
    openSessionDraftWorkspaceId: null,
    appStudio: null,
    drawer: null,
    sessionPhaseRuns: {},
    agentKindOverride: {},
    sessionGitlabMr: {},
    sessionBranches: { 'session-3': 'ak/gitlab-release' },
    projects: Array.of<Project>(),
    refreshSessionMr: vi.fn(async () => undefined),
    createMrForSession: vi.fn(async () => undefined),
    mergeMrForSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn<SpawnAgent>(async () => 'agent-3'),
    navigate: vi.fn(),
    loadAgentTranscript: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    workspaceOverrides: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
  } satisfies Store,
}));

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  useAppStore: Object.assign(<T,>(selector: (state: Store) => T) => selector(h.store), {
    getState: () => h.store,
    subscribe: () => () => undefined,
  }),
}));

vi.mock('../../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('../../client', async () => {
  const actual = await vi.importActual<typeof import('../../client')>('../../client');
  return {
    ...actual,
    gitlabMergeMr: h.gitlabMergeMr,
    gitlabProjectMergeMethods: h.gitlabProjectMergeMethods,
    gitlabListMrDiscussions: h.gitlabListMrDiscussions,
    gitlabMrApprovalState: h.gitlabMrApprovalState,
    gitlabUpdateMrState: h.gitlabUpdateMrState,
  };
});

import { MrDetailPanel } from './index';

const SESSION_ID = 'session-3' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const makeMr = ({
  mergeStatus = 'can_be_merged',
  webUrl = 'https://gitlab.com/acme/web/-/merge_requests/4',
  title = 'Add merge request dashboard',
  draft = false,
}: MrParams = {}): GitlabMergeRequest => ({
  id: 12,
  iid: 4,
  projectId: 3,
  title,
  description: null,
  state: 'opened',
  webUrl,
  sourceBranch: 'ak/mr-dashboard',
  targetBranch: 'main',
  draft,
  hasConflicts: false,
  mergeStatus,
  updatedAt: '2026-07-22T10:00:00Z',
});

beforeEach(() => {
  h.gitlabMergeMr.mockClear();
  h.gitlabProjectMergeMethods.mockClear();
  h.store.projects = [];
  h.gitlabListMrDiscussions.mockClear();
  h.gitlabListMrDiscussions.mockResolvedValue([]);
  h.gitlabMrApprovalState.mockClear();
  h.gitlabMrApprovalState.mockResolvedValue(null);
  h.gitlabUpdateMrState.mockClear();
  h.gitlabUpdateMrState.mockResolvedValue(makeMr({ title: 'Draft: Add merge request dashboard' }));
  h.store.refreshSessionMr.mockClear();
  h.store.reportError.mockClear();
  h.store.createMrForSession.mockClear();
  h.store.spawnAgent.mockClear();
  h.store.navigate.mockClear();
  h.showToast.mockClear();
  h.store.workspaceOverrides = {};
  h.store.sessionGitlabMr = {};
});

afterEach(cleanup);

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'More actions for !4' }));

describe('MrDetailPanel', () => {
  it('merges a selected MR through the GitLab client', async () => {
    const onClose = vi.fn();
    const onRefresh = vi.fn();
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onRefresh={onRefresh}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(screen.getByText('Merge !4?')).toBeDefined();
    expect(h.gitlabMergeMr).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));

    await waitFor(() =>
      expect(h.gitlabMergeMr).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        host: 'https://gitlab.com',
        projectPath: 'acme/web',
        mrIid: 4,
        method: 'merge',
        expectedHeadSha: null,
      }),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('merges with the Goodboy project that owns the repository and the method it prefers', async () => {
    const ledger = aProject({
      workspaceId: WORKSPACE_ID,
      name: 'ledger-core',
      remoteUrl: 'ssh://gitlab.com/acme/web.git',
    });
    h.store.projects = [
      aProject({
        workspaceId: WORKSPACE_ID,
        name: 'notify-relay',
        remoteUrl: 'ssh://gitlab.com/acme/relay.git',
      }),
      ledger,
    ];
    h.gitlabProjectMergeMethods.mockResolvedValueOnce({
      mergeMethod: 'ff',
      squashOption: 'default_off',
      onlyAllowMergeIfPipelineSucceeds: false,
    });
    render(
      <MrDetailPanel
        mr={{ ...makeMr(), sha: 'a41c9e2b7d3f' }}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));

    await waitFor(() =>
      expect(h.gitlabMergeMr).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        projectId: ledger.id,
        host: 'https://gitlab.com',
        projectPath: 'acme/web',
        mrIid: 4,
        method: 'rebase',
        expectedHeadSha: 'a41c9e2b7d3f',
      }),
    );
  });

  it('merges with the host default method when the project settings are off limits', async () => {
    h.gitlabProjectMergeMethods.mockRejectedValueOnce(
      new CommandError({
        kind: 'http',
        message: '403 Forbidden',
        failure: { kind: 'denied', status: 403, retryAfterSeconds: null, detail: 'Forbidden' },
      }),
    );
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));

    await waitFor(() =>
      expect(h.gitlabMergeMr).toHaveBeenCalledWith(expect.objectContaining({ method: 'merge' })),
    );
  });

  it('merges nothing and says so when the project settings cannot be reached', async () => {
    h.gitlabProjectMergeMethods.mockRejectedValueOnce(new Error('connection reset'));
    const onClose = vi.fn();
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));

    await waitFor(() => expect(h.store.reportError).toHaveBeenCalledOnce());
    expect(h.gitlabMergeMr).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the panel open when the host refuses the merge, and merges on a retry', async () => {
    h.gitlabMergeMr.mockRejectedValueOnce(new Error('405 Method Not Allowed'));
    const onClose = vi.fn();
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm merge' }));

    await waitFor(() => expect(h.gitlabMergeMr).toHaveBeenCalledOnce(), { timeout: 5000 });
    await waitFor(() => expect(h.store.reportError).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(onClose).not.toHaveBeenCalled();
    expect(h.showToast).not.toHaveBeenCalled();

    if (screen.queryByRole('button', { name: 'Confirm merge' }) === null) {
      fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    }
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm merge' }, { timeout: 5000 }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce(), { timeout: 5000 });
    expect(h.gitlabMergeMr).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['Merge', 'Merge !4?'],
    ['Close merge request', 'Close !4?'],
  ] as const)('backing out of the %s confirmation writes nothing', (label, question) => {
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    if (label === 'Merge') {
      fireEvent.click(screen.getByRole('button', { name: label }));
    } else {
      openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
    }
    expect(screen.getByText(question)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(question)).toBeNull();
    expect(h.gitlabMergeMr).not.toHaveBeenCalled();
    expect(h.gitlabUpdateMrState).not.toHaveBeenCalled();
  });

  it('says the branches once, as a fact, with the last update', () => {
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('ak/mr-dashboard → main')).toBeDefined();
    expect(screen.queryByText('Source branch')).toBeNull();
    expect(screen.getByRole('group', { name: 'Properties' }).querySelector('time')).not.toBeNull();
    expect(screen.getByText('No description.')).toBeDefined();
  });

  it('disables merge when GitLab reports cannot_be_merged', () => {
    render(
      <MrDetailPanel
        mr={makeMr({ mergeStatus: 'cannot_be_merged' })}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Merge' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('renders the discussion threads without the system notes', async () => {
    h.gitlabListMrDiscussions.mockResolvedValue([
      {
        id: 'disc-1',
        individualNote: false,
        notes: [
          {
            id: 1,
            body: 'This needs a guard clause',
            system: false,
            author: { username: 'bob', name: 'Bob', avatarUrl: null },
            createdAt: '2026-07-22T10:00:00Z',
            resolvable: true,
            resolved: false,
            position: null,
          },
          {
            id: 2,
            body: 'changed title from foo to bar',
            system: true,
            author: null,
            createdAt: '2026-07-22T10:01:00Z',
            resolvable: false,
            resolved: null,
            position: null,
          },
        ],
      },
    ]);
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('This needs a guard clause')).toBeDefined());
    expect(screen.queryByText('changed title from foo to bar')).toBeNull();
    expect(screen.getByText('1 system event hidden')).toBeDefined();
  });

  it('toggles the draft prefix on the title and reflects the answer', async () => {
    h.gitlabUpdateMrState.mockResolvedValue(
      makeMr({ title: 'Draft: Add merge request dashboard', draft: true }),
    );
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Convert to draft' }));

    await waitFor(() =>
      expect(h.gitlabUpdateMrState).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        host: 'https://gitlab.com',
        projectPath: 'acme/web',
        mrIid: 4,
        title: 'Draft: Add merge request dashboard',
      }),
    );
    await waitFor(() => expect(h.gitlabUpdateMrState).toHaveBeenCalledOnce());
    openMenu();
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Mark ready' })).toBeDefined());
  });

  it('closes the merge request through the state command', async () => {
    h.gitlabUpdateMrState.mockResolvedValue({ ...makeMr(), state: 'closed' });
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Close merge request' }));
    expect(screen.getByText('Close !4?')).toBeDefined();
    expect(h.gitlabUpdateMrState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm close' }));

    await waitFor(() =>
      expect(h.gitlabUpdateMrState).toHaveBeenCalledWith(
        expect.objectContaining({ stateEvent: 'close', mrIid: 4 }),
      ),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reopen' })).toBeDefined());
  });

  it('hides the approval row when the GitLab instance has no approvals endpoint', async () => {
    render(
      <MrDetailPanel
        mr={makeMr()}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(h.gitlabMrApprovalState).toHaveBeenCalledOnce());
    expect(screen.queryByText('Approvals')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('disables merge when the MR project path cannot be parsed', () => {
    render(
      <MrDetailPanel
        mr={makeMr({ webUrl: 'not a URL' })}
        workspaceId={WORKSPACE_ID}
        host="https://gitlab.com"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Merge' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});
