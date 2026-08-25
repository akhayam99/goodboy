// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { ResolverStatus } from '../../resolver-linkage';

const state = vi.hoisted(() => ({
  sessionGithub: {} as Record<string, unknown>,
  sessionPendingResolutions: {} as Record<string, ReadonlyArray<unknown>>,
}));

const resolvers = vi.hoisted(() => ({ links: [] as ReadonlyArray<unknown> }));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

vi.mock('../../hooks/useResolverIndex', () => ({
  useResolverIndex: () => resolvers,
}));

import { OverviewResolve } from './OverviewResolve';

const sessionId = 'session-1' as SessionId;

const session = {
  id: sessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship it',
  stateKind: 'idle',
  createdAt: '2026-08-20T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-08-20T00:00:00.000Z' as IsoDateTime,
  agents: [],
  workflowRuns: [],
} as unknown as Session;

const link = (status: ResolverStatus) => ({ agent: { id: `agent-${status}` }, status });

const reviewComment = (resolved: boolean) => ({ source: 'review', resolved });

const setUp = (next: {
  readonly links?: ReadonlyArray<unknown>;
  readonly comments?: ReadonlyArray<unknown>;
  readonly pending?: ReadonlyArray<unknown>;
}) => {
  resolvers.links = next.links ?? [];
  state.sessionGithub = { [sessionId]: { detail: { comments: next.comments ?? [] } } };
  state.sessionPendingResolutions = { [sessionId]: next.pending ?? [] };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OverviewResolve', () => {
  it('stays out of the way when nothing is waiting', () => {
    setUp({});
    const { container } = render(<OverviewResolve session={session} onSelectLens={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('counts the unresolved review comments and opens the resolve lens', () => {
    setUp({ comments: [reviewComment(false), reviewComment(false), reviewComment(true)] });
    const onSelectLens = vi.fn();
    render(<OverviewResolve session={session} onSelectLens={onSelectLens} />);

    fireEvent.click(screen.getByText('2 comments to resolve'));

    expect(onSelectLens).toHaveBeenCalledWith('resolve');
  });

  it('counts only the resolvers that have not settled', () => {
    setUp({ links: [link('running'), link('awaiting'), link('resolved'), link('wontfix')] });
    render(<OverviewResolve session={session} onSelectLens={vi.fn()} />);

    expect(screen.getByText('2 resolvers still open')).toBeTruthy();
    expect(screen.getByText('1 running')).toBeTruthy();
  });

  it('falls back to the resolutions waiting to be pushed', () => {
    setUp({ pending: [{ threadId: 'thread-1' }] });
    render(<OverviewResolve session={session} onSelectLens={vi.fn()} />);

    expect(screen.getByText('1 resolution ready to push')).toBeTruthy();
  });
});
