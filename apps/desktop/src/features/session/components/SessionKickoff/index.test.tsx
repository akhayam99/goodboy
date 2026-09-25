// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

const { store, hooks, spies } = vi.hoisted(() => ({
  store: {
    githubStatus: null as { readonly mode: string; readonly user?: string } | null,
    workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
    projects: [] as ReadonlyArray<unknown>,
    sessionExternalTasks: {} as Record<
      string,
      ReadonlyArray<{ provider: string; externalId: string }>
    >,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ status: string }>>,
    sessionProjectMounts: { 'sess-kickoff': [{ projectId: 'project-1' }] } as Record<
      string,
      ReadonlyArray<{ projectId: string }>
    >,
    phaseTemplates: {} as Record<
      string,
      ReadonlyArray<{ id: string; name: string; description: string; deletedAt?: string }>
    >,
    pendingKickoffFocusSessionId: null as string | null,
    clearPendingKickoffFocus: vi.fn(),
    loadPhaseTemplates: vi.fn(async () => undefined),
    attachWorkflowToSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn(async () => 'agent-2'),
    openArtifactCreation: vi.fn(),
    linkSessionExternalTask: vi.fn(async () => undefined),
    upsertSessionSlot: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  },
  hooks: {
    isGithubAuthenticated: { current: false },
  },
  spies: {
    fetchIssueCandidates: vi.fn(
      async (_params: unknown): Promise<ReadonlyArray<IssueCandidate>> => [],
    ),
    showToast: vi.fn(),
    onPickIssue: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
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

vi.mock('../../../integrations/fetchIssueCandidates', () => ({
  fetchIssueCandidates: (params: unknown) => spies.fetchIssueCandidates(params as never),
}));

vi.mock('../../../integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: ({ provider }: { provider: string }) => (
    <span data-testid={`glyph-${provider}`} />
  ),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: spies.showToast }),
}));

import { SessionKickoff } from './index';

const SESSION_ID = 'sess-kickoff' as SessionId;
const session = {
  id: SESSION_ID,
  workspaceId: 'ws-1',
  goal: 'Untitled session',
} as unknown as Session;

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

const renderKickoff = () =>
  render(
    <SessionKickoff
      session={session}
      onOpenWorkflowBuilder={vi.fn()}
      onPickIssue={spies.onPickIssue}
    />,
  );

const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(name) });

beforeEach(() => {
  localStorage.clear();
  store.workspaceIntegrations = {};
  store.projects = [];
  store.sessionExternalTasks = {};
  store.sessionPhaseRuns = {};
  store.phaseTemplates = {
    'ws-1': [
      { id: 'wf-1', name: 'Plan and build', description: 'Plan, then implement' },
      { id: 'wf-2', name: 'Fix a bug', description: 'Reproduce and fix' },
    ],
  };
  store.pendingKickoffFocusSessionId = null;
  store.clearPendingKickoffFocus.mockClear();
  store.attachWorkflowToSession.mockClear();
  store.spawnAgent.mockClear();
  store.openArtifactCreation.mockClear();
  store.linkSessionExternalTask.mockClear();
  store.upsertSessionSlot.mockClear();
  hooks.isGithubAuthenticated.current = false;
  spies.fetchIssueCandidates.mockReset();
  spies.fetchIssueCandidates.mockResolvedValue([]);
  spies.showToast.mockClear();
  spies.onPickIssue.mockClear();
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
    expect(screen.queryByText('No activity yet')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Example run' })).toBeNull();
  });

  it('preselects Run a workflow when no tracker has candidates', () => {
    renderKickoff();

    expect(radio('Run a workflow').getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Run workflow' })).toHaveLength(1);
  });

  it('preselects Pick up a task when the tracker has candidates', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    renderKickoff();

    await screen.findByText('ENG-1');
    expect(radio('Pick up a task').getAttribute('aria-checked')).toBe('true');
  });

  it('falls back to Run a workflow when the tracker has nothing open', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    renderKickoff();

    await waitFor(() => expect(radio('Run a workflow').getAttribute('aria-checked')).toBe('true'));
  });

  it('remembers the last choice for the workspace', () => {
    const first = renderKickoff();
    fireEvent.click(radio('Not sure yet'));
    first.unmount();

    renderKickoff();
    expect(radio('Not sure yet').getAttribute('aria-checked')).toBe('true');
  });

  it('shows only the selected option primary', () => {
    renderKickoff();
    fireEvent.click(radio('Not sure yet'));

    expect(screen.getByRole('button', { name: 'Start Scout' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Run workflow' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pick up/ })).toBeNull();
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

  it('lands focus on the question for a new session and clears the flag', () => {
    store.pendingKickoffFocusSessionId = SESSION_ID;
    renderKickoff();

    expect(document.activeElement).toBe(radio('Run a workflow'));
    expect(store.clearPendingKickoffFocus).toHaveBeenCalledOnce();
  });

  it('runs the picked workflow with the goal', async () => {
    renderKickoff();
    const run = screen.getByRole('button', { name: 'Run workflow' });
    expect(run.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByRole('textbox', { name: 'Workflow goal' }), {
      target: { value: '  Round once per batch  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Fix a bug/ }));
    fireEvent.click(run);

    await waitFor(() => expect(store.attachWorkflowToSession).toHaveBeenCalledOnce());
    expect(store.attachWorkflowToSession).toHaveBeenCalledWith(SESSION_ID, 'wf-2', {
      goal: 'Round once per batch',
      navigate: true,
    });
  });

  it('starts a Scout with the optional focus as its first message', async () => {
    renderKickoff();
    fireEvent.click(radio('Not sure yet'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Scout focus' }), {
      target: { value: 'the ledger-core importer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start Scout' }));

    await waitFor(() => expect(store.spawnAgent).toHaveBeenCalledOnce());
    expect(store.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'scout',
      initialPrompt: expect.stringContaining('Focus on: the ledger-core importer'),
      focus: 'agent',
    });
  });

  it('links the picked issue from the primary and hands it on', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
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

    await waitFor(() => expect(store.linkSessionExternalTask).toHaveBeenCalledOnce());
    expect(store.linkSessionExternalTask).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ provider: 'linear', externalId: 'issue-1', identifier: 'ENG-1' }),
    );
    expect(store.upsertSessionSlot).not.toHaveBeenCalled();
    expect(spies.onPickIssue).toHaveBeenCalledWith({ candidate: candidate({}) });
    expect(spies.showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: 'Linked ENG-1 to this session.',
    });
  });

  it('hands nothing on when the link fails', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    store.linkSessionExternalTask.mockRejectedValueOnce(new Error('offline'));
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);
    renderKickoff();
    await screen.findByText('ENG-1');

    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick up ENG-1' }));

    await waitFor(() => expect(store.linkSessionExternalTask).toHaveBeenCalledOnce());
    expect(spies.onPickIssue).not.toHaveBeenCalled();
  });

  it('hides issues a session already picked up and caps each tracker at five', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    store.sessionExternalTasks = { 'sess-other': [{ provider: 'linear', externalId: 'issue-0' }] };
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

  it('keeps the wireframe in a quiet menu and the report out until there is evidence', () => {
    renderKickoff();
    fireEvent.click(screen.getByRole('button', { name: 'More ways to start' }));

    expect(screen.getByRole('menuitem', { name: /Draw a wireframe/ })).toBeDefined();
    expect(screen.queryByRole('menuitem', { name: /Write a report/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: /Draw a wireframe/ }));
    expect(store.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
      workflowRunId: null,
    });
  });

  it('offers the report once an agent has finished', () => {
    store.sessionPhaseRuns = { [SESSION_ID]: [{ status: 'completed' }] };
    renderKickoff();
    fireEvent.click(screen.getByRole('button', { name: 'More ways to start' }));

    fireEvent.click(screen.getByRole('menuitem', { name: /Write a report/ }));
    expect(store.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'report',
      workflowRunId: null,
    });
  });
});
