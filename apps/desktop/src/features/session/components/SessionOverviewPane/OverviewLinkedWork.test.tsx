// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const { state, github } = vi.hoisted(() => ({
  state: {
    sessionExternalTasks: {} as Record<string, ReadonlyArray<unknown>>,
    sessionGithub: {} as Record<string, { linkedIssues?: ReadonlyArray<unknown> }>,
    workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  },
  github: { authenticated: false },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: github.authenticated,
    isResolved: true,
    isScoped: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../SessionWorkspace/parts/IntegrationPane/LinkTicketPopover', () => ({
  LinkTicketPopover: ({ provider, noun }: { provider: string; noun: string }) => (
    <button type="button" data-testid={`link-${provider}`}>
      {`Link ${noun}`}
    </button>
  ),
}));

import { OverviewLinkedWork } from './OverviewLinkedWork';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'sess-1' as SessionId;

const session = { id: SESSION_ID, workspaceId: WS_ID } as Session;

beforeEach(() => {
  state.sessionExternalTasks = {};
  state.sessionGithub = {};
  state.workspaceIntegrations = {};
  github.authenticated = false;
});
afterEach(cleanup);

describe('OverviewLinkedWork', () => {
  it('offers the issue picker for the workspace tracker binding', () => {
    state.workspaceIntegrations = { [WS_ID]: [{ provider: 'linear' }] };
    render(<OverviewLinkedWork session={session} />);
    expect(screen.getByText('Linked work')).toBeDefined();
    expect(screen.getByTestId('link-linear')).toBeDefined();
    expect(screen.queryByText(/no tracker connected/i)).toBeNull();
  });

  it('offers GitHub linking when the workspace is authenticated with gh', () => {
    github.authenticated = true;
    render(<OverviewLinkedWork session={session} />);
    expect(screen.getByTestId('link-github')).toBeDefined();
  });

  it('names the tracker on each action when several are bound', () => {
    state.workspaceIntegrations = { [WS_ID]: [{ provider: 'linear' }, { provider: 'jira' }] };
    render(<OverviewLinkedWork session={session} />);
    expect(screen.getByText('Link Linear issue')).toBeDefined();
    expect(screen.getByText('Link Jira issue')).toBeDefined();
  });

  it('shows a quiet connect hint with no dead button when no tracker is bound', () => {
    render(<OverviewLinkedWork session={session} />);

    expect(screen.queryByTestId(/^link-/)).toBeNull();
    expect(screen.getByText(/no tracker connected yet/i)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('leaves the header chips to tell the story once work is linked', () => {
    state.sessionExternalTasks = { [SESSION_ID]: [{ provider: 'linear' }] };
    state.workspaceIntegrations = { [WS_ID]: [{ provider: 'linear' }] };
    const { container } = render(<OverviewLinkedWork session={session} />);
    expect(container.firstChild).toBeNull();
  });
});
