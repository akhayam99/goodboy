// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { hooks, remote, store } = vi.hoisted(() => {
  const sessionOpenQuestions: Record<string, ReadonlyArray<unknown>> = {
    'session-1': [],
  };
  return {
    hooks: {
      agentCount: 0,
      planCount: 0,
      questionCount: 0,
      liveTerminals: 0,
      summarizerStatus: 'idle' as 'idle' | 'running' | 'error',
    },
    remote: { kind: 'github' as 'github' | 'gitlab' | 'other' | null },
    store: {
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
    },
  };
});

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useNonResolverStandaloneAgents: () =>
    Array.from({ length: hooks.agentCount }, (_, index) => ({
      id: `agent-${index}`,
      status: 'running',
    })),
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

vi.mock('../../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => remote.kind,
}));

import { LensColumn } from './LensColumn';

const SESSION = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

beforeEach(() => {
  remote.kind = 'github';
  hooks.agentCount = 0;
  hooks.planCount = 0;
  hooks.questionCount = 0;
  hooks.liveTerminals = 0;
  hooks.summarizerStatus = 'idle';
  store.sessionPhaseRuns = {};
  store.reviewDrafts = {};
  store.sessionExternalTasks = {};
  store.workspaceIntegrations = {
    'workspace-1': [{ provider: 'linear' }, { provider: 'sentry' }],
  };
  store.sessionLoading['session-1'] = { agents: false, plans: false };
  store.sessionOpenQuestions = { 'session-1': [] };
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
        .getAllByText(/^(Work|Artifacts|Context|Integrations|Infra)$/)
        .map((heading) => heading.textContent),
    ).toEqual(['Work', 'Artifacts', 'Context', 'Integrations', 'Infra']);
    expect(
      screen.getAllByRole('button').map((button) => {
        const clone = button.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
        const shortcut = clone.querySelector('kbd')?.textContent ?? '';
        return clone.textContent?.replace(shortcut, '').trim();
      }),
    ).toEqual([
      'Overview',
      'Workflows',
      'Agents',
      'Resolve',
      'Questions',
      'Diff',
      'Plans',
      'Scripts',
      'Goal',
      'Decisions',
      'Session summary',
      'GitHub',
      'Linear',
      'Sentry',
      'Terminal',
    ]);
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
    expect(screen.getByRole('button', { name: 'GitLab issues 1' })).toBeDefined();

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

    expect(screen.getByRole('button', { name: 'GitLab' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'GitLab issues 1' })).toBeDefined();
  });

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

  it('hides disconnected integration rows without linked tasks', () => {
    remote.kind = 'other';
    store.workspaceIntegrations = {};

    render(
      <LensColumn
        session={SESSION}
        activeLens={null}
        onSelectOverview={vi.fn()}
        onSelect={vi.fn()}
        filesCount={0}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Linear' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sentry' })).toBeNull();
    expect(screen.queryByRole('button', { name: /GitLab issues/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'GitHub' })).toBeNull();
  });
});
