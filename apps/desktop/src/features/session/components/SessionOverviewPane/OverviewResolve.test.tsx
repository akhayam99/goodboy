// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';

const state = vi.hoisted(() => ({
  sessionGithub: {} as Record<string, unknown>,
  sessionPendingResolutions: {} as Record<string, ReadonlyArray<unknown>>,
  sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
  projects: [] as ReadonlyArray<unknown>,
  activateNextResolver: vi.fn(async () => undefined),
}));

const resolvers = vi.hoisted(() => ({ links: [] as ReadonlyArray<unknown> }));
const spawnResolver = vi.hoisted(() => vi.fn(async () => 'agent-1'));
const statuses = vi.hoisted(() => ({ value: new Map<string, unknown>() }));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (value: typeof state) => T) => selector(state),
}));

vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));

vi.mock('../../../chat/spawn-from-comment', () => ({
  buildCommentAgentArgs: vi.fn(() => ({ name: 'resolver', model: 'model', effort: 'medium' })),
}));

vi.mock('../../agent-kind', () => ({
  kindRouting: () => ({ provider: 'anthropic', model: 'model', effort: 'medium' }),
}));

vi.mock('../../hooks/useResolverIndex', () => ({
  useResolverIndex: () => resolvers,
}));

vi.mock('../../hooks/useResolverSpawner', () => ({
  useResolverSpawner: () => ({ spawnResolver }),
}));

vi.mock('../../hooks/useWorktreeStatuses', () => ({
  useWorktreeStatuses: () => statuses.value,
}));

vi.mock('../../resolver-linkage', () => ({
  resolverForComment: () => undefined,
}));

vi.mock('./SuggestionRebaseRow', () => ({
  SuggestionRebaseRow: ({ projectName }: { readonly projectName: string }) => (
    <div>Rebase {projectName} on main</div>
  ),
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

const reviewComment = ({
  id,
  resolved = false,
}: {
  readonly id: string;
  readonly resolved?: boolean;
}) => ({
  id,
  threadId: id,
  source: 'review',
  resolved,
  url: `https://example.com/${id}`,
  createdAt: '2026-08-20T00:00:00.000Z',
});

const setUp = ({
  comments = [],
  mounts = [],
}: {
  readonly comments?: ReadonlyArray<unknown>;
  readonly mounts?: ReadonlyArray<unknown>;
}) => {
  state.sessionGithub = {
    [sessionId]: { pr: { number: 42 }, detail: { comments } },
  };
  state.sessionPendingResolutions = { [sessionId]: [] };
  state.sessionProjectMounts = { [sessionId]: mounts };
  state.projects = [];
  resolvers.links = [];
  statuses.value = new Map();
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('OverviewResolve', () => {
  it('omits the complete suggestions section when nothing is actionable', () => {
    setUp({});
    const { container } = render(<OverviewResolve session={session} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows one review suggestion with the unresolved comment count', () => {
    setUp({
      comments: [reviewComment({ id: 'thread-1' }), reviewComment({ id: 'thread-2' })],
    });
    render(<OverviewResolve session={session} />);

    expect(screen.getByRole('region', { name: 'Suggestions' })).toBeDefined();
    expect(screen.getByText('Resolve review comments on PR #42')).toBeDefined();
    expect(screen.getByText('2 comments')).toBeDefined();
  });

  it('wires the resolve CTA through the shared batch spawn flow', async () => {
    setUp({
      comments: [reviewComment({ id: 'thread-1' }), reviewComment({ id: 'thread-2' })],
    });
    render(<OverviewResolve session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    await waitFor(() => expect(spawnResolver).toHaveBeenCalledTimes(2));
    expect(state.activateNextResolver).toHaveBeenCalledWith(sessionId);
  });

  it('shows a rebase suggestion only for a mounted project behind main', () => {
    const mount = {
      projectId: 'project-1',
      mountName: 'api',
      worktreePath: '/worktree/api',
    };
    setUp({ mounts: [mount] });
    state.projects = [{ id: 'project-1', name: 'API' }];
    statuses.value = new Map([
      [
        '/worktree/api',
        {
          mainDistance: { kind: 'known', ahead: 0, behind: 3 },
          upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
        },
      ],
    ]);
    render(<OverviewResolve session={session} />);

    expect(screen.getByText('Rebase API on main')).toBeDefined();
  });
});
