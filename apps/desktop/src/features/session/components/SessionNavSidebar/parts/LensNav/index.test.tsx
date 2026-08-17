// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
      attachedRuns: [] as ReadonlyArray<unknown>,
      resolverLinks: [] as ReadonlyArray<unknown>,
    },
    remote: {
      kind: 'github' as 'github' | 'gitlab' | 'other' | null,
      isGithubAuthenticated: true,
    },
    store: {
      sessionMounts: {},
      sessionActiveMount: {},
      setSessionActiveMount: vi.fn(async () => undefined),
      agentKindOverride: {},
      activeLens: {} as Record<string, string | null>,
      setActiveLens: vi.fn(),
      sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
      sessionPlans: {} as Record<string, ReadonlyArray<unknown>>,
      sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
      reviewDrafts: {} as Record<string, ReadonlyArray<unknown>>,
      scriptRuns: {},
      terminalSessions: {},
      sessionGithub: {},
      sessionGitlabMr: {},
      sessionPendingResolutions: {},
      sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
      workspaceIntegrations: {},
      sessionLoading: {
        'session-1': { agents: false, plans: false },
      },
      sessionOpenQuestions,
      sessionFileVersions: {} as Record<string, ReadonlyArray<unknown>>,
      sessionFileVersionsLoading: {},
      loadSessionFileVersions: vi.fn(async () => undefined),
      loadReviewDrafts: vi.fn(async () => undefined),
    },
  };
});

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useIsSessionCollectionLoaded: ({
    sessionId,
    collection,
  }: {
    readonly sessionId: string;
    readonly collection: string;
  }) => {
    const records: Record<string, Record<string, ReadonlyArray<unknown>>> = {
      agents: store.sessionPhaseRuns,
      plans: store.sessionPlans,
      workflows: store.sessionWorkflows,
      reviewDrafts: store.reviewDrafts,
      externalTasks: store.sessionExternalTasks,
      openQuestions: store.sessionOpenQuestions,
      fileVersions: store.sessionFileVersions,
    };
    return records[collection]?.[sessionId] !== undefined;
  },
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

vi.mock('../../../../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => hooks.attachedRuns,
}));

vi.mock('../../../../hooks/useResolverIndex', () => ({
  useResolverIndex: () => ({ links: hooks.resolverLinks, byThreadId: new Map() }),
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
    isAuthenticated: remote.isGithubAuthenticated,
    isResolved: true,
    refresh: vi.fn(async () => undefined),
  }),
}));

import { LensNav } from './index';
import { shortcutGlyphs } from '../../../../../../shared/keyboard/registry';

const SESSION = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

beforeEach(() => {
  remote.kind = 'github';
  remote.isGithubAuthenticated = true;
  hooks.agentCount = 0;
  hooks.doneAgentCount = 0;
  hooks.planCount = 0;
  hooks.questionCount = 0;
  hooks.liveTerminals = 0;
  hooks.summarizerStatus = 'idle';
  hooks.attachedRuns = [];
  hooks.resolverLinks = [];
  store.sessionPhaseRuns = { 'session-1': [] };
  store.sessionPlans = { 'session-1': [] };
  store.sessionWorkflows = { 'session-1': [] };
  store.reviewDrafts = { 'session-1': [] };
  store.sessionGithub = {};
  store.sessionExternalTasks = { 'session-1': [] };
  store.workspaceIntegrations = {
    'workspace-1': [{ provider: 'linear' }, { provider: 'sentry' }],
  };
  store.sessionLoading['session-1'] = { agents: false, plans: false };
  store.sessionOpenQuestions = { 'session-1': [] };
  store.sessionFileVersions = {};
  store.sessionFileVersionsLoading = {};
  store.loadSessionFileVersions.mockClear();
  store.loadReviewDrafts.mockClear();
  store.activeLens = {};
  store.setActiveLens.mockClear();
});

afterEach(cleanup);

describe('LensNav', () => {
  it('renders active Overview and selects it', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

    const overview = screen.getByRole('button', { name: 'Overview' });
    expect(overview.getAttribute('aria-current')).toBe('page');
    fireEvent.click(overview);
    expect(store.setActiveLens).toHaveBeenCalledWith('session-1', null);
  });

  it('uses a subtle active style and softens the tone of inactive rows', () => {
    store.activeLens = { 'session-1': 'agents' };
    render(<LensNav session={SESSION} filesCount={0} />);

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
    const { container } = render(<LensNav session={SESSION} filesCount={0} />);

    expect(container.querySelector('[title="GitLab disconnected"]')).not.toBeNull();
    expect(container.querySelector('[title="Linear disconnected"]')).toBeNull();
  });

  it('orders the regrouped lens sections and rows', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

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
      'Jira',
      'Slack',
    ]);
    expect(screen.queryByRole('button', { name: 'Explore' })).toBeNull();
  });

  it('renders only shared-context lenses for a branchless session', () => {
    render(<LensNav session={SESSION} filesCount={3} isBranchless />);

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

  it('counts the workflows that are still running, not the ones already done', () => {
    hooks.attachedRuns = [
      {
        run: { id: 'run-done', executionMode: 'dynamic', orchestrationOutcome: 'done' },
        workflow: { id: 'wf-1', steps: [] },
      },
      {
        run: { id: 'run-live', executionMode: 'dynamic' },
        workflow: { id: 'wf-2', steps: [] },
      },
    ];
    render(<LensNav session={SESSION} filesCount={0} />);

    const workflows = screen.getByRole('button', { name: /Workflows/ });

    expect(workflows.textContent).toContain('1');
  });

  it('leaves the workflow count off when every workflow is done', () => {
    hooks.attachedRuns = [
      {
        run: { id: 'run-done', executionMode: 'dynamic', orchestrationOutcome: 'done' },
        workflow: { id: 'wf-1', steps: [] },
      },
    ];
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: /Workflows/ }).textContent).not.toMatch(/\d/);
  });

  it('shows a registry shortcut on every row', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'Diff' }).querySelector('kbd')?.textContent).toBe(
      shortcutGlyphs('lens.files'),
    );
    expect(screen.getByRole('button', { name: 'Linear' }).querySelector('kbd')?.textContent).toBe(
      shortcutGlyphs('lens.linear'),
    );
    expect(screen.getByRole('button', { name: 'Agents' }).querySelector('kbd')?.textContent).toBe(
      shortcutGlyphs('lens.agents'),
    );
  });

  it('reserves loading badges while keeping rows selectable', () => {
    hooks.agentCount = 3;
    hooks.planCount = 2;
    hooks.questionCount = 1;
    store.sessionLoading['session-1'] = { agents: true, plans: true };
    store.sessionOpenQuestions = {};

    render(<LensNav session={SESSION} filesCount={0} />);

    const agents = screen.getByRole('button', { name: 'Agents' });
    expect(screen.getByTestId('lens-count-loading-agents')).toBeDefined();
    expect(screen.getByTestId('lens-count-loading-questions')).toBeDefined();
    expect(screen.getByTestId('lens-count-loading-plans')).toBeDefined();
    expect(agents.textContent).not.toContain('3');
    fireEvent.click(agents);
    expect(store.setActiveLens).toHaveBeenCalledWith('session-1', 'agents');
  });

  it('shows loaded agent and plan counts', () => {
    hooks.agentCount = 3;
    hooks.planCount = 2;
    hooks.questionCount = 1;

    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'Agents Running 3' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Plans 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Questions 1' })).toBeDefined();
    expect(screen.queryByTestId('lens-count-loading-agents')).toBeNull();
    expect(screen.queryByTestId('lens-count-loading-plans')).toBeNull();
  });

  it('shows diff totals instead of the file count and falls back when unchanged', () => {
    const { rerender } = render(
      <LensNav session={SESSION} filesCount={4} diffstat={{ additions: 12, deletions: 3 }} />,
    );

    expect(screen.getByRole('button', { name: 'Diff +12 -3' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Diff 4' })).toBeNull();

    rerender(
      <LensNav session={SESSION} filesCount={4} diffstat={{ additions: 0, deletions: 0 }} />,
    );

    expect(screen.getByRole('button', { name: 'Diff 4' })).toBeDefined();
  });

  it('excludes user-completed agents from the agents count', () => {
    hooks.agentCount = 2;
    hooks.doneAgentCount = 1;

    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'Agents Running 2' })).toBeDefined();
  });

  it('keeps the question badge loading until questions resolve', () => {
    hooks.questionCount = 2;
    store.sessionOpenQuestions = {};

    render(<LensNav session={SESSION} filesCount={0} />);

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
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'Linear 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sentry 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'GitLab 1' })).toBeDefined();

    cleanup();
    remote.kind = 'gitlab';
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'GitLab 1' })).toBeDefined();
  });

  it('counts linked github tasks plus the open PR on the GitHub row', () => {
    store.sessionExternalTasks = {
      'session-1': [{ provider: 'github' }, { provider: 'linear' }],
    };
    store.sessionGithub = { 'session-1': { pr: { number: 42 } } };

    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'GitHub 2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Linear 1' })).toBeDefined();

    cleanup();
    store.sessionGithub = {};
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByRole('button', { name: 'GitHub 1' })).toBeDefined();
  });

  it('marks an open PR or MR with a static indicator, never a pulsing running dot', () => {
    store.sessionGithub = { 'session-1': { pr: { number: 42 } } };
    store.sessionGitlabMr = { 'session-1': { mr: { iid: 7 } } };

    render(<LensNav session={SESSION} filesCount={0} />);

    const github = screen.getByRole('button', { name: 'GitHub 1' });
    expect(github.querySelector('[class*="bg-accent"]')).not.toBeNull();
    expect(github.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(github.querySelector('[class*="bg-info"]')).toBeNull();

    const gitlab = screen.getByRole('button', { name: 'GitLab' });
    expect(gitlab.querySelector('[class*="bg-accent"]')).not.toBeNull();
    expect(gitlab.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(gitlab.querySelector('[class*="bg-info"]')).toBeNull();
  });

  it('gives Linear and Sentry no dot, matching the shared integrations badge grammar', () => {
    store.sessionExternalTasks = {
      'session-1': [{ provider: 'linear' }, { provider: 'sentry' }],
    };

    render(<LensNav session={SESSION} filesCount={0} />);

    const linear = screen.getByRole('button', { name: 'Linear 1' });
    const sentry = screen.getByRole('button', { name: 'Sentry 1' });
    for (const row of [linear, sentry]) {
      expect(row.querySelector('[class*="bg-accent"]')).toBeNull();
      expect(row.querySelector('[class*="bg-info"]')).toBeNull();
      expect(row.querySelector('[class*="animate-pulse"]')).toBeNull();
    }
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
      remote.isGithubAuthenticated = false;
      const listener = vi.fn();
      window.addEventListener(studioEvent, listener);

      render(<LensNav session={SESSION} filesCount={0} />);
      const row = screen.getByRole('button', { name: label });
      fireEvent.click(row);

      expect(row.className).toContain('opacity-40');
      expect(store.setActiveLens).toHaveBeenCalledWith('session-1', lens);
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener(studioEvent, listener);
    },
  );

  it('shows the review board lens only for PR review sessions', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.queryByRole('button', { name: /Review board/ })).toBeNull();

    cleanup();
    store.sessionPhaseRuns = {
      'session-1': [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };
    store.reviewDrafts = { 'session-1': [{ id: 'draft-1', status: 'draft' }] };
    render(<LensNav session={SESSION} filesCount={0} />);

    const row = screen.getByRole('button', { name: 'Review board 1' });
    fireEvent.click(row);
    expect(store.setActiveLens).toHaveBeenCalledWith('session-1', 'review');
  });

  it('counts live terminals and pulses only while some are alive', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

    const idle = screen.getByRole('button', { name: 'Terminal' });
    expect(idle.querySelector('[class*="animate-pulse"]')).toBeNull();

    cleanup();
    hooks.liveTerminals = 2;
    render(<LensNav session={SESSION} filesCount={0} />);

    const live = screen.getByRole('button', { name: 'Terminal Running 2' });
    expect(live.querySelector('[class*="animate-pulse"]')).not.toBeNull();
  });

  it('pulses every context row while the summarizer runs', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

    for (const label of ['Goal', 'Decisions', 'Session summary']) {
      expect(
        screen.getByRole('button', { name: label }).querySelector('[class*="animate-pulse"]'),
      ).toBeNull();
    }

    cleanup();
    hooks.summarizerStatus = 'running';
    render(<LensNav session={SESSION} filesCount={0} />);

    for (const label of ['Goal', 'Decisions', 'Session summary']) {
      expect(
        screen
          .getByRole('button', { name: `${label} Running` })
          .querySelector('[class*="animate-pulse"]'),
      ).not.toBeNull();
    }
  });

  it('marks every context row for attention when the summarizer failed', () => {
    hooks.summarizerStatus = 'error';
    const { container } = render(<LensNav session={SESSION} filesCount={0} />);

    for (const label of ['Goal', 'Decisions', 'Session summary']) {
      const row = screen.getByRole('button', { name: `${label} Needs attention` });
      expect(row.querySelector('[class*="bg-warning"]')).not.toBeNull();
      expect(row.querySelector('[class*="animate-pulse"]')).toBeNull();
    }
    expect(container.querySelectorAll('[class*="animate-pulse"]')).toHaveLength(0);
  });

  it('shimmers a never-loaded count instead of claiming zero', () => {
    store.sessionWorkflows = {};
    store.sessionExternalTasks = {};

    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByTestId('lens-count-loading-workflows')).toBeDefined();
    expect(screen.getByTestId('lens-count-loading-pr')).toBeDefined();
    expect(screen.getByTestId('lens-count-loading-linear')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Workflows' }).textContent).not.toContain('0');
  });

  it('keeps every row mounted and countless when its collection is loaded and empty', () => {
    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.queryByTestId('lens-count-loading-workflows')).toBeNull();
    expect(screen.queryByTestId('lens-count-loading-pr')).toBeNull();
    const workflows = screen.getByRole('button', { name: 'Workflows' });
    expect(workflows).toBeDefined();
    expect(workflows.textContent).not.toContain('0');
  });

  it('stops shimmering once the settle window elapses without ever printing a zero', () => {
    vi.useFakeTimers();
    store.sessionWorkflows = {};

    render(<LensNav session={SESSION} filesCount={0} />);

    expect(screen.getByTestId('lens-count-loading-workflows')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.queryByTestId('lens-count-loading-workflows')).toBeNull();
    expect(screen.getByRole('button', { name: 'Workflows' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Workflows' }).textContent).not.toContain('0');
    vi.useRealTimers();
  });

  it('re-arms the settle timer on a session switch instead of freezing the shimmer off', () => {
    vi.useFakeTimers();
    store.sessionWorkflows = {};

    const { rerender } = render(<LensNav session={SESSION} filesCount={0} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByTestId('lens-count-loading-workflows')).toBeNull();

    const SESSION_2 = {
      id: 'session-2',
      workspaceId: 'workspace-1',
      workflowRuns: [],
    } as unknown as Session;

    rerender(<LensNav session={SESSION_2} filesCount={0} />);

    expect(screen.getByTestId('lens-count-loading-workflows')).toBeDefined();
    vi.useRealTimers();
  });

  it('fetches review drafts for a PR review session whose drafts were never loaded', () => {
    store.sessionPhaseRuns = {
      'session-1': [{ id: 'agent-1', name: 'pr review', kind: 'pr-reviewer' }],
    };
    store.reviewDrafts = {};

    render(<LensNav session={SESSION} filesCount={0} />);

    expect(store.loadReviewDrafts).toHaveBeenCalledWith('session-1');
    expect(screen.getByTestId('lens-count-loading-review')).toBeDefined();
  });

  it('keeps the pending-push dot on the Resolve row even with zero active resolvers', () => {
    hooks.resolverLinks = [];
    store.sessionPendingResolutions = { 'session-1': [{}] };
    render(<LensNav session={SESSION} filesCount={0} />);

    const resolveRow = screen.getByRole('button', { name: 'Resolve Resolutions queued to push' });
    expect(resolveRow.querySelector('[class*="bg-accent"]')).not.toBeNull();
  });
});
