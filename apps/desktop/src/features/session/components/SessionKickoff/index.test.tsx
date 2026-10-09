// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { IsoDateTime, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

type TestState = Record<string, unknown>;

const { holder, hooks, spies } = vi.hoisted(() => ({
  holder: { store: null as UseBoundStore<StoreApi<TestState>> | null },
  hooks: {
    isGithubAuthenticated: { current: false },
    lookup: { current: null as unknown },
    starredRows: { current: [] as ReadonlyArray<unknown> },
  },
  spies: {
    fetchIssueCandidates: vi.fn(
      async (_params: unknown): Promise<ReadonlyArray<IssueCandidate>> => [],
    ),
    loadPhaseTemplates: vi.fn(async () => undefined),
    startSessionFromDraft: vi.fn(async (_params: unknown) => ({ id: 'sess-new', goal: 'Fix it' })),
    requestIssueBrief: vi.fn(async (_params: unknown) => undefined),
    runBuilder: vi.fn(async (_session: unknown) => undefined),
    follow: vi.fn(),
  },
}));

vi.mock('../../../../store', async () => {
  const { create } = await vi.importActual<typeof import('zustand')>('zustand');
  const store = create<TestState>(() => ({}));
  holder.store = store;
  return { EMPTY_ARRAY: Object.freeze([]), useAppStore: store };
});

type BuilderKickoffStub = {
  readonly primaryLabel?: string;
  readonly goal: string;
  readonly goalPlaceholder: string;
  readonly onGoalChange: (goal: string) => void;
  readonly start: (run: (session: unknown) => Promise<void>) => Promise<void>;
};

vi.mock('../../../workflows/components/WorkflowBuilderView', () => ({
  WorkflowBuilderView: ({ kickoff }: { readonly kickoff: BuilderKickoffStub }) => (
    <div data-testid="workflow-builder">
      <textarea
        aria-label="Goal"
        placeholder={kickoff.goalPlaceholder}
        value={kickoff.goal}
        onChange={(event) => kickoff.onGoalChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() => void kickoff.start(spies.runBuilder).catch(() => undefined)}
      >
        {kickoff.primaryLabel ?? 'Start run'}
      </button>
    </div>
  ),
}));

vi.mock('../../../../shared/hooks/useFollowToast', () => ({
  useFollowToast: () => spies.follow,
}));

vi.mock('../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: hooks.isGithubAuthenticated.current,
    isResolved: true,
    isScoped: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../integrations/jira/useJiraConfig', () => ({
  useJiraConfig: () => null,
}));

vi.mock('../../../inbox/useInboxStars', () => ({
  useInboxStars: () => ({
    rows: hooks.starredRows.current,
    isStarred: () => false,
    canStar: () => false,
    toggle: async () => undefined,
  }),
}));
vi.mock('../../../integrations/hooks/useWorkspaceIssueLookup', () => ({
  useWorkspaceIssueLookup: () =>
    hooks.lookup.current ?? { code: null, state: { status: 'idle' }, retry: () => undefined },
}));
vi.mock('../../../integrations/sentry/client', () => ({
  sentryListCodeMappings: async () => [],
}));
vi.mock('../../../integrations/fetchIssueCandidates', () => ({
  fetchIssueCandidates: (params: unknown) => spies.fetchIssueCandidates(params as never),
}));

vi.mock('../../../integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: ({ provider }: { provider: string }) => (
    <span data-testid={`glyph-${provider}`} />
  ),
  integrationLabel: ({ provider }: { provider: string }) => provider,
}));

import { SessionKickoff } from './index';
import { patchSessionDraft } from '../../../../store/slices/sessionDraft/patchSessionDraft';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const candidate = (overrides: Partial<IssueCandidate>): IssueCandidate => ({
  provider: 'linear',
  externalId: 'issue-1',
  identifier: 'ENG-1',
  title: 'Fix the login redirect',
  url: 'https://linear.app/acme/issue/ENG-1',
  goal: '[ENG-1] Fix the login redirect\n\nThe redirect loops.',
  body: 'The redirect loops.',
  branchSlug: 'fix-the-login-redirect',
  ...overrides,
});

const PROJECT_OVERRIDES = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const project = (overrides: Partial<Project>): Project => ({
  id: 'project-ledger-core' as ProjectId,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
  kind: 'repo',
  overrides: PROJECT_OVERRIDES,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  ...overrides,
});

const store = () => {
  if (holder.store === null) {
    throw new Error('store mock not ready');
  }
  return holder.store;
};

const resetStore = () => {
  const testStore = store();
  testStore.setState(
    {
      githubStatus: null,
      workspaceIntegrations: {},
      projects: [],
      workspaces: [],
      providers: [],
      sessionExternalTasks: {},
      sessionPhaseRuns: {},
      issueBriefs: {},
      sessionDrafts: {},
      projectSentryLinks: {},
      settings: { 'composer.classicKeys': 'false' },
      loadSetting: async () => null,
      phaseTemplates: {
        'ws-1': [
          { id: 'wf-1', name: 'Plan and build', description: 'Plan, then implement' },
          { id: 'wf-2', name: 'Fix a bug', description: 'Reproduce and fix' },
        ],
      },
      loadPhaseTemplates: spies.loadPhaseTemplates,
      startSessionFromDraft: spies.startSessionFromDraft,
      requestIssueBrief: spies.requestIssueBrief,
      patchSessionDraft: patchSessionDraft(testStore.setState as never),
    },
    true,
  );
};

const renderKickoff = () => render(<SessionKickoff workspaceId={WORKSPACE_ID} />);

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) });

beforeEach(() => {
  localStorage.clear();
  resetStore();
  hooks.isGithubAuthenticated.current = false;
  hooks.lookup.current = null;
  hooks.starredRows.current = [];
  spies.fetchIssueCandidates.mockReset();
  spies.fetchIssueCandidates.mockResolvedValue([]);
  spies.startSessionFromDraft.mockReset();
  spies.startSessionFromDraft.mockResolvedValue({ id: 'sess-new', goal: 'Fix it' });
  spies.follow.mockClear();
  spies.requestIssueBrief.mockClear();
});

afterEach(cleanup);

describe('SessionKickoff', () => {
  it('shows three choices on one row as tabs, no example tree or tiles', () => {
    renderKickoff();

    expect(screen.getByRole('tablist', { name: 'How do you want to start?' })).toBeDefined();
    const kinds = screen.getByRole('tablist', { name: 'How do you want to start?' });
    expect(
      within(kinds)
        .getAllByRole('tab')
        .map((node) => node.textContent),
    ).toEqual([
      'Pick up a taskAn issue from your tracker.',
      'Run a workflowOrchestrated, steps you describe, or a saved workflow.',
      'Ask an agentScout or any other role.',
    ]);
    expect(screen.queryByRole('button', { name: 'More ways to start' })).toBeNull();
  });

  it('preselects Run a workflow when no tracker has candidates', () => {
    renderKickoff();

    expect(tab('Run a workflow').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('workflow-builder')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Start run' })).toHaveLength(1);
  });

  it('preselects Pick up a task when the tracker has candidates', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    renderKickoff();

    await screen.findByText('ENG-1');
    expect(tab('Pick up a task').getAttribute('aria-selected')).toBe('true');
  });

  it('falls back to Run a workflow when the tracker has nothing open', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    renderKickoff();

    await waitFor(() => expect(tab('Run a workflow').getAttribute('aria-selected')).toBe('true'));
  });

  it('keeps the choice and the text in the draft, and preselects again once it is gone', () => {
    const first = renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the importer' },
    });
    first.unmount();

    const second = renderKickoff();
    expect(tab('Ask an agent').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Scout focus' })).toHaveProperty(
      'value',
      'the importer',
    );
    second.unmount();

    store().setState({ sessionDrafts: {} });
    renderKickoff();
    expect(tab('Run a workflow').getAttribute('aria-selected')).toBe('true');
  });

  it('shows only the selected option primary', () => {
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));

    expect(screen.getByRole('button', { name: 'Start Scout on the whole project' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Start run' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Pick / })).toBeNull();
  });

  it('puts focus on the selected tab when the draft opens', () => {
    renderKickoff();

    expect(document.activeElement).toBe(tab('Run a workflow'));
  });

  it('moves with the arrow keys and focuses the panel field right away', async () => {
    renderKickoff();
    const workflow = tab('Run a workflow');
    workflow.focus();

    fireEvent.keyDown(workflow, { key: 'ArrowRight' });
    expect(tab('Ask an agent').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Ask an agent'));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Scout focus' })),
    );

    fireEvent.keyDown(tab('Ask an agent'), { key: 'ArrowLeft' });
    expect(tab('Run a workflow').getAttribute('aria-selected')).toBe('true');
  });

  it('feeds one goal field into the builder and starts the session with the run', async () => {
    renderKickoff();

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), {
      target: { value: '  Round once per batch  ' },
    });
    expect(
      (store().getState().sessionDrafts as Record<string, { workflowGoal: string }>)['ws-1']
        ?.workflowGoal,
    ).toBe('  Round once per batch  ');
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow-run', goal: 'Round once per batch', run: spies.runBuilder },
    });
  });

  it('keeps the goal in the draft when the start fails', async () => {
    spies.startSessionFromDraft.mockRejectedValueOnce(new Error('provider offline'));
    renderKickoff();
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), {
      target: { value: 'Round once per batch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(screen.getByRole('textbox', { name: 'Goal' })).toHaveProperty(
      'value',
      'Round once per batch',
    );
  });

  it('starts a Scout with the optional focus as its first message', async () => {
    const onReveal = vi.fn();
    window.addEventListener('goodboy:reveal-chat', onReveal);
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the ledger-core importer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Scout' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'scout',
        focus: 'the ledger-core importer',
        prompt: expect.stringContaining('Focus on: the ledger-core importer'),
        routing: null,
      },
    });
    await waitFor(() => expect(onReveal).toHaveBeenCalledOnce());
    window.removeEventListener('goodboy:reveal-chat', onReveal);
  });

  it('requires a prompt for every role other than Scout', () => {
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    fireEvent.click(screen.getByRole('button', { name: 'Role: Scout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Implement' }));

    const start = screen.getByRole('button', { name: 'Start Implementer' });
    expect(start.hasAttribute('disabled')).toBe(true);
    expect(start.getAttribute('title')).toBe('Write what Implementer should do');

    fireEvent.change(screen.getByRole('textbox', { name: 'Agent instructions' }), {
      target: { value: 'Build the login page' },
    });
    expect(screen.getByRole('button', { name: 'Start Implementer' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('starts any role with the model auto until pinned', async () => {
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    fireEvent.click(screen.getByRole('button', { name: 'Role: Scout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Implement' }));

    expect(screen.getByRole('button', { name: 'Auto' })).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent instructions' }), {
      target: { value: 'Build the login page' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Implementer' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'implementer',
        focus: 'Build the login page',
        prompt: 'Build the login page',
        routing: null,
      },
    });
  });

  it('shows no project chip with zero or one project in the workspace', () => {
    const first = renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    expect(screen.queryByRole('button', { name: /^Project:/ })).toBeNull();
    first.unmount();

    store().setState({ projects: [project({})] });
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    expect(screen.queryByRole('button', { name: /^Project:/ })).toBeNull();
  });

  it('preselects the sole project without a chip', async () => {
    store().setState({ projects: [project({})] });
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the ledger-core importer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Scout' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(store().getState().sessionDrafts).toMatchObject({
      [WORKSPACE_ID]: { projectId: 'project-ledger-core' },
    });
  });

  it('shows a project chip and lets you pick when the workspace has more than one', () => {
    store().setState({
      projects: [project({}), project({ id: 'project-northwind' as ProjectId, name: 'northwind' })],
    });
    renderKickoff();
    fireEvent.click(tab('Ask an agent'));

    expect(screen.getByRole('button', { name: 'Project: ledger-core' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Project: ledger-core' }));
    fireEvent.click(screen.getByRole('option', { name: 'northwind' }));

    expect(screen.getByRole('button', { name: 'Project: northwind' })).toBeDefined();
    expect(store().getState().sessionDrafts).toMatchObject({
      [WORKSPACE_ID]: { projectId: 'project-northwind' },
    });
  });

  it('picks an issue into one block: an editable brief title, how to work on it, and the one start', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([
      candidate({}),
      candidate({ externalId: 'issue-3', identifier: 'ENG-3', title: 'Speed up the board' }),
    ]);
    renderKickoff();
    await screen.findByText('ENG-1');

    expect(screen.getByRole('button', { name: 'Pick an issue' }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Search issues' }), {
      target: { value: 'login' },
    });
    expect(screen.queryByText('ENG-3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ENG-1' }));

    expect(spies.requestIssueBrief).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, sessionId: null }),
    );
    expect(spies.startSessionFromDraft).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Use brief' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Search issues' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Brief title' })).toHaveProperty(
      'value',
      'Fix the login redirect',
    );
    expect(screen.getByRole('tab', { name: 'Run a workflow' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const builder = screen.getByTestId('workflow-builder');
    const goalField = within(builder).getByRole('textbox', { name: 'Goal' });
    expect((goalField as HTMLTextAreaElement).value).toBe(
      '[ENG-1] Fix the login redirect\n\nThe redirect loops.',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Brief title' }), {
      target: { value: 'Stop the login redirect loop' },
    });
    fireEvent.change(goalField, { target: { value: 'Fix the login redirect loop' } });
    fireEvent.click(within(builder).getByRole('button', { name: 'Start from ENG-1' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: candidate({}),
        title: 'Stop the login redirect loop',
        goal: 'Fix the login redirect loop',
        then: { kind: 'workflow-run', run: spies.runBuilder },
      },
    });
    expect(screen.queryByRole('button', { name: /Fix a bug/ })).toBeNull();
    await waitFor(() => expect(spies.follow).toHaveBeenCalledOnce());
    expect(spies.follow).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Run started', startKey: 'sess-new' }),
    );
  });

  it('puts Dismiss back on the list and clears the picked issue', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    renderKickoff();
    await screen.findByText('ENG-1');

    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ENG-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.getByRole('textbox', { name: 'Search issues' })).toBeDefined();
    expect(
      (store().getState().sessionDrafts as Record<string, { pickedIssue: unknown }>)['ws-1']
        ?.pickedIssue,
    ).toBeNull();
  });

  it('mounts the project of a github issue and lets you pick none before starting', async () => {
    hooks.isGithubAuthenticated.current = true;
    store().setState({
      projects: [project({ remoteUrl: 'git@github.com:acme/ledger-core.git' })],
    });
    const githubIssue = candidate({
      provider: 'github',
      externalId: 'gh-7',
      identifier: '#7',
      title: 'Ledger totals drift',
      url: 'https://github.com/acme/ledger-core/issues/7',
    });
    spies.fetchIssueCandidates.mockResolvedValue([githubIssue]);
    renderKickoff();
    await screen.findByText('#7');

    fireEvent.click(screen.getByRole('button', { name: /#7/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick #7' }));

    expect(screen.getByText('from GitHub repo acme/ledger-core')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start from #7' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: expect.objectContaining({
        kind: 'task',
        candidate: githubIssue,
        mount: { projectId: 'project-ledger-core', reason: 'from GitHub repo acme/ledger-core' },
      }),
    });
  });

  it('mounts the project linked to the sentry project of an error', async () => {
    store().setState({
      workspaceIntegrations: { 'ws-1': [{ provider: 'sentry' }] },
      projects: [project({})],
      projectSentryLinks: {
        'ws-1': [{ projectId: 'project-ledger-core', sentryProject: 'ledger-api' }],
      },
    });
    const sentryIssue = candidate({
      provider: 'sentry',
      externalId: 'se-1',
      identifier: 'LEDGER-API-4',
      title: 'TypeError in totals',
      url: 'https://harborline.sentry.io/issues/1/',
      sentryProject: 'ledger-api',
    });
    spies.fetchIssueCandidates.mockResolvedValue([sentryIssue]);
    renderKickoff();
    await screen.findByText('LEDGER-API-4');

    fireEvent.click(screen.getByRole('button', { name: /LEDGER-API-4/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick LEDGER-API-4' }));

    expect(screen.getByText('from Sentry project ledger-api')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start from LEDGER-API-4' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: expect.objectContaining({
        mount: { projectId: 'project-ledger-core', reason: 'from Sentry project ledger-api' },
        then: { kind: 'workflow-run', run: spies.runBuilder },
      }),
    });
  });

  it('lets how to work on it start an agent instead, precompiled with the brief', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    renderKickoff();
    await screen.findByText('ENG-1');

    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ENG-1' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Ask an agent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start from ENG-1' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: candidate({}),
        title: 'Fix the login redirect',
        goal: '[ENG-1] Fix the login redirect\n\nThe redirect loops.',
        then: {
          kind: 'agent',
          agentKind: 'implementer',
          prompt: '[ENG-1] Fix the login redirect\n\nThe redirect loops.',
          routing: null,
        },
      },
    });
  });

  it('keeps open starred issues on top and leaves the closed ones in the inbox', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    const linearRecord = (id: string, identifier: string, title: string) => ({
      key: `linear:issue:${id}`,
      provider: 'linear',
      kind: 'issue',
      identifier,
      title,
      state: 'open',
      stateLabel: 'Todo',
      updatedAt: '2026-09-20T10:00:00Z',
      url: `https://linear.app/cascadia/issue/${identifier}`,
      context: 'Cascadia',
      payload: {
        provider: 'linear',
        kind: 'issue',
        sessionId: null,
        issue: {
          id,
          identifier,
          title,
          description: '',
          url: `https://linear.app/cascadia/issue/${identifier}`,
          state: { name: 'Todo', type: 'unstarted' },
          team: { key: 'CAS' },
          labels: { nodes: [] },
        },
      },
    });
    hooks.starredRows.current = [
      {
        issue: { provider: 'linear', externalId: 'lin-231', identifier: 'CAS-231', state: 'open' },
        record: linearRecord('lin-231', 'CAS-231', 'Settle the month close'),
      },
      {
        issue: { provider: 'linear', externalId: 'lin-12', identifier: 'CAS-12', state: 'done' },
        record: linearRecord('lin-12', 'CAS-12', 'Old close'),
      },
    ];
    renderKickoff();

    const starred = await screen.findByRole('list', { name: 'Starred issues' });
    expect(starred.textContent).toContain('CAS-231');
    expect(screen.queryByText('CAS-12')).toBeNull();
  });

  it('picks up an issue found by code that is not assigned to you', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    const found = candidate({
      externalId: 'issue-231',
      identifier: 'CAS-231',
      title: 'Settle the month close',
      url: 'https://linear.app/cascadia/issue/CAS-231',
    });
    hooks.lookup.current = {
      code: 'CAS-231',
      retry: () => undefined,
      state: {
        status: 'done',
        key: 'CAS-231#0',
        value: {
          route: { kind: 'lookup', label: 'CAS-231', targets: [] },
          result: {
            hits: [
              {
                target: { provider: 'linear', identifier: 'CAS-231' },
                candidate: found,
                record: {
                  key: 'linear:issue:issue-231',
                  provider: 'linear',
                  kind: 'issue',
                  identifier: 'CAS-231',
                  title: 'Settle the month close',
                  state: 'open',
                  stateLabel: 'Todo',
                  updatedAt: '2026-09-20T10:00:00Z',
                  url: found.url,
                  context: 'Cascadia',
                  payload: {},
                },
              },
            ],
            misses: [],
          },
        },
      },
    };
    renderKickoff();
    await screen.findByText('Not in Tasks');

    fireEvent.click(screen.getByRole('option', { name: /CAS-231 Settle the month close/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick CAS-231' }));

    expect(spies.requestIssueBrief).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, sessionId: null }),
    );
  });

  it('hides issues a session already picked up and caps each tracker at five', async () => {
    store().setState({
      workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] },
      sessionExternalTasks: { 'sess-other': [{ provider: 'linear', externalId: 'issue-0' }] },
    });
    spies.fetchIssueCandidates.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) =>
        candidate({ externalId: `issue-${index}`, identifier: `ENG-${index}` }),
      ),
    );
    renderKickoff();

    await screen.findByText('ENG-1');
    expect(screen.queryByText('ENG-0')).toBeNull();
    expect(screen.getByText('ENG-5')).toBeDefined();
    expect(screen.queryByText('ENG-6')).toBeNull();
  });

  it('offers the tracker connect links under Pick up a task without a tracker', () => {
    const onOpenSettings = vi.fn();
    window.addEventListener('goodboy:open-settings', onOpenSettings);
    renderKickoff();
    fireEvent.click(tab('Pick up a task'));

    expect(screen.getByText('No tracker connected yet')).toBeDefined();
    for (const provider of ['linear', 'github', 'gitlab', 'jira', 'sentry']) {
      expect(screen.getByTestId(`glyph-${provider}`)).toBeDefined();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Connect Linear' }));
    expect(onOpenSettings.mock.calls[0]?.[0]).toMatchObject({
      detail: { scope: 'tools', tool: 'linear' },
    });
    window.removeEventListener('goodboy:open-settings', onOpenSettings);
    expect(spies.fetchIssueCandidates).not.toHaveBeenCalled();
  });
});
