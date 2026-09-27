// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { WorkspaceId } from '@goodboy/types';
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
    startSessionFromDraft: vi.fn(async (_params: unknown) => ({ id: 'sess-new' })),
    requestIssueBrief: vi.fn(async (_params: unknown) => undefined),
  },
}));

vi.mock('../../../../store', async () => {
  const { create } = await vi.importActual<typeof import('zustand')>('zustand');
  const store = create<TestState>(() => ({}));
  holder.store = store;
  return { EMPTY_ARRAY: Object.freeze([]), useAppStore: store };
});

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
  resetStore();
  hooks.isGithubAuthenticated.current = false;
  hooks.lookup.current = null;
  hooks.starredRows.current = [];
  spies.fetchIssueCandidates.mockReset();
  spies.fetchIssueCandidates.mockResolvedValue([]);
  spies.startSessionFromDraft.mockReset();
  spies.startSessionFromDraft.mockResolvedValue({ id: 'sess-new' });
  spies.requestIssueBrief.mockClear();
});

afterEach(cleanup);

describe('SessionKickoff', () => {
  it('shows three choices on one row as tabs, no example tree or tiles', () => {
    renderKickoff();

    expect(screen.getByRole('tablist', { name: 'How do you want to start?' })).toBeDefined();
    expect(screen.getAllByRole('tab').map((node) => node.textContent)).toEqual([
      'Pick up a taskAn issue from your tracker.',
      'Run a workflowPreset or orchestrated.',
      'Ask an agentScout or any other role.',
    ]);
    expect(screen.queryByRole('button', { name: 'More ways to start' })).toBeNull();
  });

  it('preselects Run a workflow when no tracker has candidates', () => {
    renderKickoff();

    expect(tab('Run a workflow').getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Run workflow' })).toHaveLength(1);
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
    expect(screen.queryByRole('button', { name: 'Run workflow' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pick up/ })).toBeNull();
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

  it('starts the session and the picked workflow in one gesture', async () => {
    renderKickoff();
    const run = screen.getByRole('button', { name: 'Run workflow' });
    expect(run.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow goal' }), {
      target: { value: '  Round once per batch  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Fix a bug/ }));
    fireEvent.click(run);

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow', workflowId: 'wf-2', goal: 'Round once per batch' },
    });
  });

  it('keeps the draft and says why inline when the start fails', async () => {
    spies.startSessionFromDraft.mockRejectedValueOnce(new Error('provider offline'));
    renderKickoff();
    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow goal' }), {
      target: { value: 'Round once per batch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run workflow' }));

    expect((await screen.findByRole('alert')).textContent).toContain('provider offline');
    expect(screen.getByRole('textbox', { name: 'Workflow goal' })).toHaveProperty(
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

  it('proposes the brief of a picked issue and starts from it without linking first', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([
      candidate({}),
      candidate({ externalId: 'issue-3', identifier: 'ENG-3', title: 'Speed up the board' }),
    ]);
    renderKickoff();
    await screen.findByText('ENG-1');

    expect(screen.getByRole('button', { name: 'Pick up issue' }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Search issues' }), {
      target: { value: 'login' },
    });
    expect(screen.queryByText('ENG-3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick up ENG-1' }));

    expect(spies.requestIssueBrief).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, sessionId: null }),
    );
    expect(spies.startSessionFromDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use issue text' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: candidate({}),
        title: 'Fix the login redirect',
        goal: '[ENG-1] Fix the login redirect\n\nThe redirect loops.',
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
    await screen.findByText('Not in your inbox');

    fireEvent.click(screen.getByRole('option', { name: /CAS-231 Settle the month close/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick up CAS-231' }));

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
