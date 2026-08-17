// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, DiffComment, Session, SessionId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  diffComments: [] as ReadonlyArray<DiffComment>,
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: [] as never[],
  useAppStore: <T,>(selector: (s: typeof state.store) => T) => selector(state.store),
  useDiffComments: () => state.diffComments,
}));

vi.mock('../../../ResolverAgentsLane', () => ({
  ResolverAgentsLane: ({ mode }: { mode?: 'active' | 'finished' }) => (
    <div data-testid={`lane-${mode ?? 'active'}`} />
  ),
}));

vi.mock('../../../../../../shared/components/PaneShell', () => ({
  PaneShell: ({
    title,
    description,
    children,
  }: {
    readonly title?: string;
    readonly description?: string;
    readonly children: ReactNode;
  }) => (
    <section data-testid="pane-shell">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  ),
}));

vi.mock('../../../../hooks/useResolverIndex', () => ({
  useResolverIndex: () => ({
    links: state.store.__links ?? [],
    byThreadId: new Map(),
    byCommentUrl: new Map(),
    byDiffAgentId: new Map(),
  }),
}));

import { ResolvePane } from './index';

const SID = 'sess-1' as SessionId;
const session = { id: SID } as Session;

const buildAgent = (overrides: Partial<Omit<Agent, 'id'>> & { readonly id: string }): Agent =>
  ({
    sessionId: SID,
    ordinal: 0,
    name: overrides.id,
    status: 'running',
    kind: 'resolver',
    ...overrides,
    id: overrides.id as AgentId,
  }) as Agent;

beforeEach(() => {
  state.diffComments = [];
  state.store = {
    sessionGithub: {},
    sessionWorktrees: { [SID]: ['/tmp/wt'] },
    selectAgent: vi.fn(),
    __links: [],
  };
});

afterEach(cleanup);

const renderPane = () =>
  render(
    <ResolvePane
      session={session}
      meta={undefined}
      inspectedResolverId={null}
      onInspectResolver={() => undefined}
    />,
  );

describe('ResolvePane', () => {
  it('shows all four sections with honest empty states when there is nothing', () => {
    renderPane();
    expect(screen.getByRole('region', { name: 'Active resolvers' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Finished resolvers' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Open review comments' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Open diff comments' })).toBeDefined();

    expect(screen.getByText('No active resolvers')).toBeDefined();
    expect(screen.getByText('Nothing settled yet')).toBeDefined();
    expect(screen.getByText('No pull request')).toBeDefined();
    expect(screen.getByText('No open diff notes')).toBeDefined();
  });

  it('renders the lane in active mode when there is an active resolver', () => {
    state.store.__links = [{ agent: buildAgent({ id: 'agent-a' }), status: 'running' as const }];
    renderPane();
    expect(screen.getByTestId('lane-active')).toBeDefined();
    expect(screen.queryByText('No active resolvers')).toBeNull();
  });

  it('renders the lane in finished mode when there is a completed resolver', () => {
    state.store.__links = [
      {
        agent: buildAgent({ id: 'agent-b', doneAt: '2026-08-01T00:00:00Z' as never }),
        status: 'done' as const,
      },
    ];
    renderPane();
    expect(screen.getByTestId('lane-finished')).toBeDefined();
    expect(screen.queryByText('Nothing settled yet')).toBeNull();
  });

  it('never renders a Resolve comments navigation link', () => {
    state.store.__links = [{ agent: buildAgent({ id: 'agent-a' }), status: 'running' as const }];
    renderPane();
    expect(screen.queryByRole('button', { name: /Resolve comments/ })).toBeNull();
  });

  it('lists open review comments when a PR is linked', () => {
    state.store.__links = [];
    state.store.sessionGithub = {
      [SID]: {
        pr: { number: 42 },
        detail: {
          comments: [
            {
              id: 'c1',
              author: 'ada',
              authorAvatarUrl: null,
              body: 'please rename',
              createdAt: '2026-08-01T00:00:00Z',
              url: 'https://github.com/x/y/pull/42#discussion_r1',
              source: 'review',
              threadId: 'PRRT_1',
              path: 'src/App.tsx',
              line: 12,
            },
          ],
        },
      },
    };

    renderPane();
    const region = screen.getByRole('region', { name: 'Open review comments' });
    expect(within(region).getByText('ada')).toBeDefined();
    expect(within(region).getByText('src/App.tsx:12')).toBeDefined();
    expect(within(region).queryByText('No pull request')).toBeNull();
  });

  it('lists open diff comments and opens the diff viewer on click', () => {
    const dispatched: Array<CustomEvent> = [];
    const original = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event: Event) => {
      if (event instanceof CustomEvent) {
        dispatched.push(event);
      }
      return original(event);
    };

    state.diffComments = [
      {
        id: 'd1',
        sessionId: SID,
        filePath: 'src/App.tsx',
        body: 'use the constant',
        status: 'open',
        createdAt: '2026-08-01T00:00:00Z' as DiffComment['createdAt'],
      } as DiffComment,
    ];
    renderPane();
    const region = screen.getByRole('region', { name: 'Open diff comments' });
    fireEvent.click(within(region).getByRole('button'));
    expect(dispatched.map((e) => e.type)).toContain('goodboy:open-diff-viewer');

    window.dispatchEvent = original;
  });
});
