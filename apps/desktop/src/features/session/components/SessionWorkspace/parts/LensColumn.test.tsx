// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    agentKindOverride: {},
    sessionPhaseRuns: {},
    scriptRuns: {},
    terminalSessions: {},
    sessionGithub: {},
    sessionGitlabMr: {},
    sessionPendingResolutions: {},
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

import { LensColumn } from './LensColumn';

const SESSION = {
  id: 'session-1',
  workflowRuns: [],
} as unknown as Session;

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
        .getAllByText(/^(Work|Changes|Artifacts|Context|Infra)$/)
        .map((heading) => heading.textContent),
    ).toEqual(['Work', 'Changes', 'Artifacts', 'Context', 'Infra']);
    expect(screen.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Overview',
      'Workflows',
      'Agents',
      'Resolve',
      'Questions',
      'Diff',
      'Pull request',
      'Plans',
      'Scripts',
      'Goal',
      'Decisions',
      'Session summary',
      'Terminal',
    ]);
  });
});
