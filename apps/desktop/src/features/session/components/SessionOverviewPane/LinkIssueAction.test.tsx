// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const { store, hooks } = vi.hoisted(() => ({
  store: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  },
  hooks: {
    isGithubAuthenticated: { current: false },
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('../../../integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: hooks.isGithubAuthenticated.current,
    isResolved: true,
    isScoped: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../integrations/components/IntegrationGlyph', () => ({
  IntegrationGlyph: ({ provider }: { provider: string }) => (
    <span data-testid={`glyph-${provider}`} />
  ),
}));

const linkIssueFormCalls: Array<{ provider: string; providerLabel: string }> = [];

vi.mock('../SessionWorkspace/parts/IntegrationPane/LinkIssueForm', () => ({
  LinkIssueForm: ({ provider, providerLabel }: { provider: string; providerLabel: string }) => {
    linkIssueFormCalls.push({ provider, providerLabel });
    return <div data-testid="link-issue-form">{provider}</div>;
  },
}));

import { LinkIssueAction } from './LinkIssueAction';

const SESSION_ID = 'sess-1' as SessionId;
const session = { id: SESSION_ID, workspaceId: 'ws-1' } as unknown as Session;

beforeEach(() => {
  store.workspaceIntegrations = {};
  hooks.isGithubAuthenticated.current = false;
  linkIssueFormCalls.length = 0;
});

afterEach(cleanup);

describe('LinkIssueAction', () => {
  it('guides to the integrations studios when no tracker is connected', () => {
    render(<LinkIssueAction session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));

    expect(screen.getByText(/No tracker connected yet/)).toBeDefined();
    expect(screen.queryByTestId('link-issue-form')).toBeNull();
  });

  it('goes straight to the search when exactly one tracker is connected', () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };

    render(<LinkIssueAction session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));

    expect(screen.getByTestId('link-issue-form').textContent).toBe('linear');
    expect(linkIssueFormCalls.at(-1)).toEqual({ provider: 'linear', providerLabel: 'Linear' });
    expect(screen.queryByRole('button', { name: /All trackers/ })).toBeNull();
  });

  it('offers a provider list first when several trackers are connected', () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }, { provider: 'jira' }] };
    hooks.isGithubAuthenticated.current = true;

    render(<LinkIssueAction session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Link an issue' }));

    expect(screen.queryByTestId('link-issue-form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Linear' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Jira' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'GitHub' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Jira' }));

    expect(screen.getByTestId('link-issue-form').textContent).toBe('jira');
    fireEvent.click(screen.getByRole('button', { name: /All trackers/ }));
    expect(screen.queryByTestId('link-issue-form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Linear' })).toBeDefined();
  });

  it('opens the same flow from the quiet chip presentation', () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }] };

    render(<LinkIssueAction session={session} presentation="chip" />);
    const trigger = screen.getByRole('button', { name: 'Link an issue' });

    expect(trigger.textContent).toContain('Link');
    fireEvent.click(trigger);
    expect(screen.getByTestId('link-issue-form').textContent).toBe('linear');
  });

  it('reopens on the provider list after a tracker was picked', () => {
    store.workspaceIntegrations = { 'ws-1': [{ provider: 'linear' }, { provider: 'jira' }] };

    render(<LinkIssueAction session={session} />);
    const trigger = screen.getByRole('button', { name: 'Link an issue' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Jira' }));
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(screen.queryByTestId('link-issue-form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Linear' })).toBeDefined();
  });
});
