// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { remote, store } = vi.hoisted(() => ({
  remote: { kind: 'github' as 'github' | 'gitlab' | 'other' | null },
  store: {
    agentKindOverride: {},
    sessionPhaseRuns: {},
    scriptRuns: {},
    terminalSessions: {},
    sessionGithub: {},
    sessionGitlabMr: {},
    sessionPendingResolutions: {},
    sessionExternalTasks: {},
    workspaceIntegrations: {},
  },
}));

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useNonResolverStandaloneAgents: () => [],
  useSessionOpenQuestions: () => [],
  useSessionPlans: () => [],
  useSessionStageInfo: () => ({ stage: 'done' as const, reason: 'idle' }),
  useSessionUnreadLens: () => null,
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
  store.sessionExternalTasks = {};
  store.workspaceIntegrations = {};
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
    expect(screen.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
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

  it('shows provider counts and hides GitLab issues on a GitLab remote', () => {
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
    expect(screen.queryByRole('button', { name: /GitLab issues/ })).toBeNull();
  });
});
