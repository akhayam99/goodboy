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

vi.mock('../../../integrations/fetchIssueCandidates', () => ({
  fetchIssueCandidates: (params: unknown) => spies.fetchIssueCandidates(params as never),
}));

vi.mock('../../../integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: ({ provider }: { provider: string }) => (
    <span data-testid={`glyph-${provider}`} />
  ),
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

const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(name) });

beforeEach(() => {
  resetStore();
  hooks.isGithubAuthenticated.current = false;
  spies.fetchIssueCandidates.mockReset();
  spies.fetchIssueCandidates.mockResolvedValue([]);
  spies.startSessionFromDraft.mockReset();
  spies.startSessionFromDraft.mockResolvedValue({ id: 'sess-new' });
  spies.requestIssueBrief.mockClear();
});

afterEach(cleanup);

describe('SessionKickoff', () => {
  it('asks one question with three options and no example tree or tiles', () => {
    renderKickoff();

    expect(screen.getByRole('radiogroup', { name: 'How do you want to start?' })).toBeDefined();
    expect(screen.getAllByRole('radio').map((node) => node.textContent)).toEqual([
      'Pick up a taskStart from an issue in your tracker.',
      'Run a workflowDescribe the goal, then pick a workflow.',
      'Not sure yetA Scout reads the project and suggests where to start.',
    ]);
    expect(screen.queryByRole('button', { name: 'More ways to start' })).toBeNull();
  });

  it('preselects Run a workflow when no tracker has candidates', () => {
    renderKickoff();

    expect(radio('Run a workflow').getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Run workflow' })).toHaveLength(1);
  });

  it('preselects Pick up a task when the tracker has candidates', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    renderKickoff();

    await screen.findByText('ENG-1');
    expect(radio('Pick up a task').getAttribute('aria-checked')).toBe('true');
  });

  it('falls back to Run a workflow when the tracker has nothing open', async () => {
    store().setState({ workspaceIntegrations: { 'ws-1': [{ provider: 'linear' }] } });
    renderKickoff();

    await waitFor(() => expect(radio('Run a workflow').getAttribute('aria-checked')).toBe('true'));
  });

  it('keeps the choice and the text in the draft, and preselects again once it is gone', () => {
    const first = renderKickoff();
    fireEvent.click(radio('Not sure yet'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the importer' },
    });
    first.unmount();

    const second = renderKickoff();
    expect(radio('Not sure yet').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Scout focus' })).toHaveProperty(
      'value',
      'the importer',
    );
    second.unmount();

    store().setState({ sessionDrafts: {} });
    renderKickoff();
    expect(radio('Run a workflow').getAttribute('aria-checked')).toBe('true');
  });

  it('shows only the selected option primary', () => {
    renderKickoff();
    fireEvent.click(radio('Not sure yet'));

    expect(screen.getByRole('button', { name: 'Start Scout' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Run workflow' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pick up/ })).toBeNull();
  });

  it('puts focus on the question when the draft opens', () => {
    renderKickoff();

    expect(document.activeElement).toBe(radio('Run a workflow'));
  });

  it('moves with the arrow keys and confirms with Enter', async () => {
    renderKickoff();
    const workflow = radio('Run a workflow');
    workflow.focus();

    fireEvent.keyDown(workflow, { key: 'ArrowDown' });
    expect(radio('Not sure yet').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio('Not sure yet'));

    fireEvent.keyDown(radio('Not sure yet'), { key: 'ArrowDown' });
    expect(radio('Pick up a task').getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(radio('Pick up a task'), { key: 'ArrowUp' });
    fireEvent.keyDown(radio('Not sure yet'), { key: 'Enter' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Scout focus' })),
    );
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
    fireEvent.click(radio('Not sure yet'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the ledger-core importer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Scout' }));

    await waitFor(() => expect(spies.startSessionFromDraft).toHaveBeenCalledOnce());
    expect(spies.startSessionFromDraft).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        focus: 'the ledger-core importer',
        prompt: expect.stringContaining('Focus on: the ledger-core importer'),
      },
    });
    await waitFor(() => expect(onReveal).toHaveBeenCalledOnce());
    window.removeEventListener('goodboy:reveal-chat', onReveal);
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
    fireEvent.click(radio('Pick up a task'));

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
