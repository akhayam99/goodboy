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

vi.mock('../SessionOverviewPane/ProjectMountRows/MountProjectAction', () => ({
  MountProjectAction: () => <button type="button">Mount project</button>,
}));

vi.mock('../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <div data-testid="create-agent-tile" />,
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

beforeEach(() => {
  store.workspaceIntegrations = {};
  store.projects = [];
  store.sessionExternalTasks = {};
  store.sessionPhaseRuns = {};
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
  it('offers every session action and tracker studios without trackers', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(<SessionKickoff session={session} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />);

    expect(screen.getByText('How do you want to start?')).toBeDefined();
    expect(screen.getByTestId('create-agent-tile')).toBeDefined();
    expect(screen.getByRole('button', { name: /Add workflow/ })).toBeDefined();
    expect(screen.queryByTestId('create-report-cta')).toBeNull();
    expect(screen.getByTestId('create-wireframe-cta')).toBeDefined();
    expect(screen.getByText('Or pick up an issue')).toBeDefined();
    expect(screen.getByText('No tracker connected yet')).toBeDefined();
    expect(screen.getByTestId('glyph-linear')).toBeDefined();
    expect(screen.getByTestId('glyph-github')).toBeDefined();
    expect(screen.getByTestId('glyph-gitlab')).toBeDefined();
    expect(screen.getByTestId('glyph-jira')).toBeDefined();
    expect(screen.getByTestId('glyph-sentry')).toBeDefined();
    expect(spies.fetchIssueCandidates).not.toHaveBeenCalled();
  });

  it('opens Tools settings focused on Linear from the no-tracker state', () => {
    const onOpenInbox = vi.fn();
    window.addEventListener('goodboy:open-settings', onOpenInbox);
    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect Linear' }));

    expect(onOpenInbox).toHaveBeenCalledTimes(1);
    expect(onOpenInbox.mock.calls[0]?.[0]).toMatchObject({
      detail: { scope: 'tools', tool: 'linear' },
    });
    window.removeEventListener('goodboy:open-settings', onOpenInbox);
  });

  it('opens the inbox from a connected tracker shortcut', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    const onOpenInbox = vi.fn();
    window.addEventListener('goodboy:open-inbox', onOpenInbox);
    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);
    await screen.findByText('No open issues detected');
    fireEvent.click(screen.getByRole('button', { name: 'Open Linear in the inbox' }));
    expect(onOpenInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { provider: 'linear', kind: 'issue', recordKey: undefined },
      }),
    );
    window.removeEventListener('goodboy:open-inbox', onOpenInbox);
  });

  it('shows only connected tracker studios when no open issues remain', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    spies.fetchIssueCandidates.mockResolvedValue([]);

    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No open issues detected')).toBeDefined();
    });
    expect(screen.getByTestId('glyph-linear')).toBeDefined();
    expect(screen.queryByTestId('glyph-github')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('opens the workflow builder from the tile', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(<SessionKickoff session={session} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />);

    fireEvent.click(screen.getByRole('button', { name: /Add workflow/ }));
    expect(onOpenWorkflowBuilder).toHaveBeenCalledTimes(1);
  });

  it('leads with mounting a project when the session has none', () => {
    store.sessionProjectMounts = {};
    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);

    const mount = screen.getByRole('button', { name: 'Mount project' });
    const workflow = screen.getByRole('button', { name: /Add workflow/ });
    expect(mount.compareDocumentPosition(workflow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    store.sessionProjectMounts = { 'sess-kickoff': [{ projectId: 'project-1' }] };
  });

  it('holds the report back until there is something to report, and offers the wireframe', () => {
    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);

    expect(screen.queryByTestId('create-report-cta')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mount project' })).toBeNull();

    fireEvent.click(screen.getByTestId('create-wireframe-cta'));
    expect(store.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
      workflowRunId: null,
    });
  });

  it('lists recent tracker issues, hiding ones a session already picked up', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    store.sessionExternalTasks = {
      'sess-other': [{ provider: 'linear', externalId: 'issue-2' }],
    };
    spies.fetchIssueCandidates.mockResolvedValue([
      candidate({ externalId: 'issue-1', identifier: 'ENG-1' }),
      candidate({ externalId: 'issue-2', identifier: 'ENG-2', title: 'Already picked up' }),
      candidate({ externalId: 'issue-3', identifier: 'ENG-3', title: 'Speed up the board' }),
    ]);

    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Or pick up an issue')).toBeDefined();
    });
    expect(screen.getByText('ENG-1')).toBeDefined();
    expect(screen.getByText('ENG-3')).toBeDefined();
    expect(screen.queryByText('ENG-2')).toBeNull();
    expect(spies.fetchIssueCandidates).toHaveBeenCalledTimes(1);
  });

  it('caps each tracker at five suggestions', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    spies.fetchIssueCandidates.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) =>
        candidate({ externalId: `issue-${index}`, identifier: `ENG-${index}` }),
      ),
    );

    render(<SessionKickoff session={session} onOpenWorkflowBuilder={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('ENG-0')).toBeDefined();
    });
    expect(screen.getByText('ENG-4')).toBeDefined();
    expect(screen.queryByText('ENG-5')).toBeNull();
  });

  it('links a picked issue and hands it on without applying anything', async () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };
    spies.fetchIssueCandidates.mockResolvedValue([candidate({})]);

    render(
      <SessionKickoff
        session={session}
        onOpenWorkflowBuilder={vi.fn()}
        onPickIssue={spies.onPickIssue}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('ENG-1')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));

    await waitFor(() => {
      expect(store.linkSessionExternalTask).toHaveBeenCalledTimes(1);
    });
    expect(store.linkSessionExternalTask).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        provider: 'linear',
        externalId: 'issue-1',
        identifier: 'ENG-1',
        title: 'Fix the login redirect',
        url: 'https://linear.app/acme/issue/ENG-1',
      }),
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

    render(
      <SessionKickoff
        session={session}
        onOpenWorkflowBuilder={vi.fn()}
        onPickIssue={spies.onPickIssue}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('ENG-1')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /ENG-1/ }));

    await waitFor(() => {
      expect(store.linkSessionExternalTask).toHaveBeenCalledTimes(1);
    });
    expect(spies.onPickIssue).not.toHaveBeenCalled();
  });
});
