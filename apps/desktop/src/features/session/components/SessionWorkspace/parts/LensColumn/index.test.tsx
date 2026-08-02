// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { hooks, remote, store } = vi.hoisted(() => {
  const sessionOpenQuestions: Record<string, ReadonlyArray<unknown>> = {
    'session-1': [],
  };
  return {
    hooks: {
      agentCount: 0,
      doneAgentCount: 0,
      planCount: 0,
      questionCount: 0,
      liveTerminals: 0,
      summarizerStatus: 'idle' as 'idle' | 'running' | 'error',
    },
    remote: { kind: 'github' as 'github' | 'gitlab' | 'other' | null },
    store: {
      sessionMounts: {},
      sessionActiveMount: {},
      setSessionActiveMount: vi.fn(async () => undefined),
      agentKindOverride: {},
      sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
      reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
      scriptRuns: {},
      terminalSessions: {},
      sessionGithub: {},
      sessionGitlabMr: {},
      sessionPendingResolutions: {},
      sessionExternalTasks: {},
      workspaceIntegrations: {},
      sessionLoading: {
        'session-1': { agents: false, plans: false },
      },
      sessionOpenQuestions,
      sessionFileVersions: {},
      sessionFileVersionsLoading: {},
      loadSessionFileVersions: vi.fn(async () => undefined),
      archiveTask: vi.fn(async () => undefined),
      deleteTask: vi.fn(async () => undefined),
      unarchiveTask: vi.fn(async () => undefined),
    },
  };
});

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useNonResolverStandaloneAgents: () => [
    ...Array.from({ length: hooks.agentCount }, (_, index) => ({
      id: `agent-${index}`,
      status: 'running',
    })),
    ...Array.from({ length: hooks.doneAgentCount }, (_, index) => ({
      id: `done-agent-${index}`,
      status: 'completed',
      doneAt: '2026-07-26T12:00:00.000Z',
    })),
  ],
  useSessionOpenQuestions: () =>
    Array.from({ length: hooks.questionCount }, (_, index) => ({
      id: `question-${index}`,
      status: 'open',
    })),
  useSessionPlans: () =>
    Array.from({ length: hooks.planCount }, (_, index) => ({
      id: `plan-${index}`,
      status: 'active',
    })),
  useSessionStageInfo: () => ({ stage: 'done' as const, reason: 'idle' }),
  useSessionUnreadLens: () => null,
  useLiveTerminalCount: () => hooks.liveTerminals,
  useSummarizerStatus: () => ({ status: hooks.summarizerStatus }),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('../../../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => remote.kind,
}));

vi.mock('../../../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: true,
    isResolved: true,
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../../SessionOverviewPane/EditorMenu', () => ({
  EditorMenu: () => <button type="button">open worktree</button>,
}));

vi.mock('../SessionGitActions', () => ({
  SessionGitActions: () => <button type="button">branch actions</button>,
}));

import { LensColumn } from './index';

const SESSION = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

beforeEach(() => {
  remote.kind = 'github';
  hooks.agentCount = 0;
  hooks.doneAgentCount = 0;
  hooks.planCount = 0;
  hooks.questionCount = 0;
  hooks.liveTerminals = 0;
  hooks.summarizerStatus = 'idle';
  store.sessionPhaseRuns = {};
  store.reviewDrafts = {};
  store.sessionGithub = {};
  store.sessionExternalTasks = {};
  store.workspaceIntegrations = {
    'workspace-1': [{ provider: 'linear' }, { provider: 'sentry' }],
  };
  store.sessionLoading['session-1'] = { agents: false, plans: false };
  store.sessionOpenQuestions = { 'session-1': [] };
  store.sessionFileVersions = {};
  store.sessionFileVersionsLoading = {};
  store.loadSessionFileVersions.mockClear();
  store.archiveTask.mockClear();
  store.deleteTask.mockClear();
  store.unarchiveTask.mockClear();
});

afterEach(cleanup);

describe('LensColumn', () => {
  it('renders active Overview and selects it', () => {
    const onSelectOverview = vi.fn();
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={onSelectOverview}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    const overview = screen.getByRole('button', { name: 'Overview' });
    expect(overview.getAttribute('aria-current')).toBe('page');
    fireEvent.click(overview);
    expect(onSelectOverview).toHaveBeenCalledOnce();
  });

  it('uses a subtle active style and softens the tone of inactive rows', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens="agents"
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    const agents = screen.getByRole('button', { name: 'Agents' });
    const workflows = screen.getByRole('button', { name: 'Workflows' });
    const decisions = screen.getByRole('button', { name: 'Decisions' });

    expect(agents.getAttribute('aria-current')).toBe('page');
    expect(agents.className).toContain('bg-muted text-foreground');
    expect(workflows.getAttribute('aria-current')).toBeNull();
    expect(workflows.className).toContain('text-muted-foreground');
    expect(workflows.className).not.toContain('bg-muted text-foreground');
    const activeIcon = agents.querySelector('span');
    const inactiveIcon = decisions.querySelector('span');
    expect(activeIcon?.className).toContain('opacity-100');
    expect(inactiveIcon?.className).toContain('opacity-55');
  });

  it('marks a disconnected integration and leaves connected ones unmarked', () => {
    const { container } = render(
      <LensColumn
        session={SESSION}
        activeLens="agents"
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(container.querySelector('[title="GitLab disconnected"]')).not.toBeNull();
    expect(container.querySelector('[title="Linear disconnected"]')).toBeNull();
  });

  it('orders the regrouped lens sections and rows', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens="agents"
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(
      screen
        .getAllByText(/^(Work|Context|Integrations|Infra)$/)
        .map((heading) => heading.textContent),
    ).toEqual(['Context', 'Work', 'Infra', 'Integrations']);
    expect(
      within(screen.getByRole('navigation'))
        .getAllByRole('button')
        .map((button) => {
          const clone = button.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
          const shortcut = clone.querySelector('kbd')?.textContent ?? '';
          return clone.textContent?.replace(shortcut, '').trim();
        }),
    ).toEqual([
      'Overview',
      'Goal',
      'Decisions',
      'Session summary',
      'Workflows',
      'Agents',
      'Resolve',
      'Questions',
      'Diff',
      'Plans',
      'Scripts',
      'Terminal',
      'GitHub',
      'Linear',
      'Sentry',
      'GitLab',
    ]);
    expect(screen.queryByRole('button', { name: 'Explore' })).toBeNull();
  });

  it('renders only shared-context lenses for a branchless session', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={3}
        isBranchless
      />,
    );

    expect(screen.getAllByText(/^(Work|Context)$/).map((heading) => heading.textContent)).toEqual([
      'Context',
      'Work',
    ]);
    expect(
      within(screen.getByRole('navigation'))
        .getAllByRole('button')
        .map((button) => {
          const clone = button.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
          const shortcut = clone.querySelector('kbd')?.textContent ?? '';
          return clone.textContent?.replace(shortcut, '').trim();
        }),
    ).toEqual([
      'Overview',
      'Goal',
      'Decisions',
      'Session summary',
      'Workflows',
      'Agents',
      'Questions',
      'Explore',
      'File versions',
      'Plans',
    ]);
    expect(screen.queryByText('Integrations')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Diff 3' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Explore' })).toBeDefined();
    expect(screen.getByRole('button', { name: /File versions/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Terminal' })).toBeNull();
  });

  it('shows shortcuts on bound rows only', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens="agents"
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'Diff' }).querySelector('kbd')?.textContent).toBe(
      '⌘⇧D',
    );
    expect(screen.getByRole('button', { name: 'Linear' }).querySelector('kbd')).toBeNull();
  });

  it('reserves loading badges while keeping rows selectable', () => {
    const onSelect = vi.fn();
    hooks.agentCount = 3;
    hooks.planCount = 2;
    hooks.questionCount = 1;
    store.sessionLoading['session-1'] = { agents: true, plans: true };
    store.sessionOpenQuestions = {};

    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={onSelect}
        filesCount={0}
      />,
    );

    const agents = screen.getByRole('button', { name: 'Agents' });
    expect(screen.getByTestId('lens-count-loading-agents')).toBeDefined();
    expect(screen.getByTestId('lens-count-loading-questions')).toBeDefined();
    expect(screen.getByTestId('lens-count-loading-plans')).toBeDefined();
    expect(agents.textContent).not.toContain('3');
    fireEvent.click(agents);
    expect(onSelect).toHaveBeenCalledWith('agents');
  });

  it('shows loaded agent and plan counts', () => {
    hooks.agentCount = 3;
    hooks.planCount = 2;
    hooks.questionCount = 1;

    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'Agents 3' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Plans 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Questions 1' })).toBeDefined();
    expect(screen.queryByTestId('lens-count-loading-agents')).toBeNull();
    expect(screen.queryByTestId('lens-count-loading-plans')).toBeNull();
  });

  it('shows diff totals instead of the file count and falls back when unchanged', () => {
    const { rerender } = render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={4}
        diffstat={{ additions: 12, deletions: 3 }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Diff +12 -3' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Diff 4' })).toBeNull();

    rerender(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={4}
        diffstat={{ additions: 0, deletions: 0 }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Diff 4' })).toBeDefined();
  });

  it('excludes user-completed agents from the agents count', () => {
    hooks.agentCount = 2;
    hooks.doneAgentCount = 1;

    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'Agents 2' })).toBeDefined();
  });

  it('keeps the question badge loading until questions resolve', () => {
    hooks.questionCount = 2;
    store.sessionOpenQuestions = {};

    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByTestId('lens-count-loading-questions')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Questions' }).textContent).not.toContain('2');
  });

  it('shows provider counts and keeps connected GitLab issues reachable', () => {
    store.workspaceIntegrations = {
      'workspace-1': [{ provider: 'gitlab' }],
    };
    store.sessionExternalTasks = {
      'session-1': [
        { provider: 'linear' },
        { provider: 'linear' },
        { provider: 'sentry' },
        { provider: 'gitlab' },
      ],
    };
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'Linear 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sentry 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'GitLab 1' })).toBeDefined();

    cleanup();
    remote.kind = 'gitlab';
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'GitLab 1' })).toBeDefined();
  });

  it('counts linked github tasks plus the open PR on the GitHub row', () => {
    store.sessionExternalTasks = {
      'session-1': [{ provider: 'github' }, { provider: 'linear' }],
    };
    store.sessionGithub = { 'session-1': { pr: { number: 42 } } };

    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'GitHub 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Linear 1' })).toBeDefined();

    cleanup();
    store.sessionGithub = {};
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.getByRole('button', { name: 'GitHub 1' })).toBeDefined();
  });

  it.each([
    ['GitHub', 'pr', 'goodboy:open-github-studio'],
    ['GitLab', 'gitlab_issues', 'goodboy:open-gitlab-studio'],
    ['Linear', 'linear', 'goodboy:open-linear-studio'],
    ['Sentry', 'sentry', 'goodboy:open-sentry-studio'],
  ] as const)(
    'selects the inline %s pane when disconnected instead of opening the studio',
    (label, lens, studioEvent) => {
      store.workspaceIntegrations = {};
      remote.kind = null;
      const listener = vi.fn();
      window.addEventListener(studioEvent, listener);
      const onSelect = vi.fn();

      render(
        <LensColumn
          session={SESSION}
          activeLens={null}
          onSelectOverview={vi.fn()}
          onSelect={onSelect}
          filesCount={0}
        />,
      );
      const row = screen.getByRole('button', { name: label });
      fireEvent.click(row);

      expect(row.className).toContain('opacity-40');
      expect(onSelect).toHaveBeenCalledWith(lens);
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener(studioEvent, listener);
    },
  );

  it('shows the review board lens only for PR review sessions', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.queryByRole('button', { name: /Review board/ })).toBeNull();

    cleanup();
    store.sessionPhaseRuns = {
      'session-1': [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };
    store.reviewDrafts = { 'session-1': [{ id: 'draft-1', status: 'draft' }] };
    const onSelect = vi.fn();
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={onSelect}
        filesCount={0}
      />,
    );

    const row = screen.getByRole('button', { name: 'Review board 1' });
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('review');
  });

  it('counts live terminals and pulses only while some are alive', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    const idle = screen.getByRole('button', { name: 'Terminal' });
    expect(idle.querySelector('[class*="animate-pulse"]')).toBeNull();

    cleanup();
    hooks.liveTerminals = 2;
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    const live = screen.getByRole('button', { name: 'Terminal 2' });
    expect(live.querySelector('[class*="animate-pulse"]')).not.toBeNull();
  });

  it('pulses every context row while the summarizer runs', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    for (const label of ['Goal', 'Decisions', 'Session summary']) {
      expect(
        screen.getByRole('button', { name: label }).querySelector('[class*="animate-pulse"]'),
      ).toBeNull();
    }

    cleanup();
    hooks.summarizerStatus = 'running';
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    for (const label of ['Goal', 'Decisions', 'Session summary']) {
      expect(
        screen.getByRole('button', { name: label }).querySelector('[class*="animate-pulse"]'),
      ).not.toBeNull();
    }
  });

  it('marks every context row for attention when the summarizer failed', () => {
    hooks.summarizerStatus = 'error';
    const { container } = render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    for (const label of ['Goal', 'Decisions', 'Session summary']) {
      const row = screen.getByRole('button', { name: label });
      expect(row.querySelector('[class*="bg-warning"]')).not.toBeNull();
      expect(row.querySelector('[class*="animate-pulse"]')).toBeNull();
    }
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(0);
  });
});

describe('LensColumn footer', () => {
  it('renders editor, archive, and delete after lens navigation, confirming before archiving', () => {
    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    const nav = screen.getByRole('navigation');
    const editorButton = screen.getByRole('button', { name: /open worktree/i });
    const archiveButton = screen.getByRole('button', { name: /archive session/i });
    const deleteButton = screen.getByRole('button', { name: /delete session/i });
    expect(nav.compareDocumentPosition(editorButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
    expect(
      editorButton.compareDocumentPosition(archiveButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(nav.compareDocumentPosition(archiveButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
    expect(nav.compareDocumentPosition(deleteButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );

    fireEvent.click(archiveButton);
    expect(store.archiveTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^archive session$/i }));
    expect(store.archiveTask).toHaveBeenCalledWith('session-1');
  });
});
