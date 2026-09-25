// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrComment, ProviderId, SessionId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import type { CommentThread } from '../../../github/comment-threads';

const h = vi.hoisted(() => ({
  state: {
    sessionGithub: {} as Record<string, unknown>,
    resolveQueueView: {} as Record<string, unknown>,
    providers: [] as ReadonlyArray<{ readonly id: string; readonly connection: string }>,
    cliRequirements: [] as ReadonlyArray<unknown>,
    authResults: {},
    spawnAgent: vi.fn(
      async (
        _sessionId: string,
        _args: { readonly provider?: string; readonly sourceThreadIds?: ReadonlyArray<string> },
      ) => 'agent-1',
    ),
    setAgentConfig: vi.fn(async () => undefined),
    setResolveQueueView: vi.fn(),
    reportError: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof h.state) => T) => selector(h.state),
}));
vi.mock('../../../../shared/hooks/useSessionRoleModels', () => ({
  useSessionRoleModels: () => null,
}));

import { ResolveWithPopover } from './index';

const SESSION_ID = 'session-1' as SessionId;
const CONNECTED: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'opencode', 'openrouter'];

const threadOf = (threadId: string): CommentThread => ({
  head: {
    id: `comment-${threadId}`,
    author: 'dhh',
    authorAvatarUrl: null,
    body: 'This retries forever on a 500.',
    createdAt: '2026-01-05T09:00:00.000Z',
    url: `https://github.com/acme/ledger-core/pull/12#discussion_${threadId}`,
    source: 'review',
    resolved: false,
    path: 'src/retry.ts',
    line: 84,
    threadId,
  } as PrComment,
  replies: [],
});

beforeEach(() => {
  h.state.sessionGithub = {
    [SESSION_ID]: {
      pr: { number: 12, title: 'Retry', url: 'https://github.com/acme/ledger-core/pull/12' },
    },
  };
  h.state.resolveQueueView = {};
  h.state.providers = CONNECTED.map((id) => ({ id, connection: 'connected' }));
  vi.clearAllMocks();
});

afterEach(cleanup);

const renderPopover = () =>
  render(
    <ResolveWithPopover
      sessionId={SESSION_ID}
      threads={[threadOf('PRRT_1'), threadOf('PRRT_2')]}
      label="Resolve 2"
    />,
  );

const openPopover = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Choose the model' }));
  return screen.getByRole('dialog', { name: 'Resolve 2 comments' });
};

describe('ResolveWithPopover', () => {
  it('lists every connected provider, never only Claude', () => {
    renderPopover();
    const dialog = openPopover();

    for (const id of CONNECTED) {
      expect(within(dialog).getByRole('button', { name: PROVIDER_LABEL[id] })).toBeDefined();
    }
    expect(within(dialog).getByText('One agent works on these 2 comments')).toBeDefined();
  });

  it('starts the resolve with the routing picked in the popover', async () => {
    renderPopover();
    const dialog = openPopover();

    fireEvent.click(within(dialog).getByRole('button', { name: PROVIDER_LABEL.codex }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve 2' }));

    await vi.waitFor(() => expect(h.state.spawnAgent).toHaveBeenCalledTimes(1));
    const args = h.state.spawnAgent.mock.calls[0]?.[1];
    expect(args?.provider).toBe('codex');
    expect(args?.sourceThreadIds).toEqual(['PRRT_1', 'PRRT_2']);
    await vi.waitFor(() =>
      expect(h.state.setResolveQueueView).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        patch: { lastRouting: expect.objectContaining({ provider: 'codex' }) },
      }),
    );
  });

  it('starts on the resolver default from the main button', async () => {
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve 2' }));

    await vi.waitFor(() => expect(h.state.spawnAgent).toHaveBeenCalledTimes(1));
    expect(h.state.spawnAgent.mock.calls[0]?.[1].provider).toBe('anthropic');
  });

  it('starts on the last routing used in the session from the main button', async () => {
    h.state.resolveQueueView = {
      [SESSION_ID]: {
        lastRouting: { provider: 'opencode', model: 'opencode/big-pickle', effort: 'medium' },
      },
    };
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve 2' }));

    await vi.waitFor(() => expect(h.state.spawnAgent).toHaveBeenCalledTimes(1));
    expect(h.state.spawnAgent.mock.calls[0]?.[1].provider).toBe('opencode');
  });

  it('opens on a Suggested row that says why, checked by default', () => {
    renderPopover();
    const dialog = openPopover();

    const suggested = within(dialog).getByRole('button', { name: /^Suggested / });
    expect(suggested.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(dialog).getByText(
        'Resolver default on Claude, the default provider in this workspace.',
      ),
    ).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: /^Last used here / })).toBeNull();
  });

  it('offers Last used here only when it differs from the suggestion', async () => {
    h.state.resolveQueueView = {
      [SESSION_ID]: {
        lastRouting: { provider: 'codex', model: 'gpt-5.6-terra', effort: 'medium' },
      },
    };
    renderPopover();
    const dialog = openPopover();

    const lastUsed = within(dialog).getByRole('button', { name: /^Last used here / });
    expect(lastUsed.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(lastUsed);
    expect(
      within(dialog)
        .getByRole('button', { name: /^Suggested / })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve 2' }));

    await vi.waitFor(() => expect(h.state.spawnAgent).toHaveBeenCalledTimes(1));
    expect(h.state.spawnAgent.mock.calls[0]?.[1].provider).toBe('codex');
  });
});
