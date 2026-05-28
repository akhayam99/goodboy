// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    sessionGithub: {} as Record<string, unknown>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionHasUnread: () => false,
  useSessionViewPrefs: () => ({ group: 'none' as const, sort: 'recent' as const }),
  useSortedGroupedSessions: (_w: unknown, sessions: ReadonlyArray<unknown>) => [
    { key: 'all', sessions },
  ],
}));

vi.mock('./SessionViewMenu', () => ({
  SessionViewMenu: () => null,
}));

vi.mock('../../../../features/providers/components/CostBadge', () => ({
  CostBadge: () => null,
}));

vi.mock('../../../../features/github/components/PullRequestChip', () => ({
  PullRequestChip: () => null,
  pullRequestMeta: () => null,
}));

import { SessionActivityBar } from './index';

afterEach(cleanup);

describe('SessionActivityBar', () => {
  it('renders the Sessions header and the New session button', () => {
    render(
      <SessionActivityBar
        workspaceId={'ws-1' as never}
        sessions={[]}
        archivedSessions={[]}
        currentSessionId={null}
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );
    expect(screen.getByText(/^Sessions$/)).toBeDefined();
    expect(screen.getByRole('button', { name: /create new session/i })).toBeDefined();
  });

  it('renders empty-state copy when no sessions in active tab', () => {
    render(
      <SessionActivityBar
        workspaceId={'ws-1' as never}
        sessions={[]}
        archivedSessions={[]}
        currentSessionId={null}
        onSelectSession={vi.fn()}
        onNewSession={vi.fn()}
      />,
    );
    expect(screen.getByText(/no sessions yet/i)).toBeDefined();
  });
});
