// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';

type Store = {
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
  readonly workspaceIntegrations: Readonly<Record<string, ReadonlyArray<{ provider: string }>>>;
  readonly linkSessionExternalTask: ReturnType<typeof vi.fn>;
  readonly unlinkSessionExternalTask: ReturnType<typeof vi.fn>;
};

type Props = {
  readonly children: ReactNode;
};

const h = vi.hoisted(() => ({
  store: {
    sessionExternalTasks: {},
    workspaceIntegrations: {},
    linkSessionExternalTask: vi.fn(async () => undefined),
    unlinkSessionExternalTask: vi.fn(async () => undefined),
  },
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../../../shared/lib/editor', () => ({
  openUrl: h.openUrl,
}));

vi.mock('../../../../../worktree/useRemoteHostKind', () => ({
  useRemoteHostKind: () => 'github',
}));

vi.mock('./LinearTaskDetail', () => ({
  LinearTaskDetail: ({ issueId }: { issueId: string }) => <div>Linear detail {issueId}</div>,
}));

vi.mock('./SentryTaskDetail', () => ({
  SentryTaskDetail: ({ task }: { task: SessionExternalTask }) => (
    <div>Sentry detail {task.externalId}</div>
  ),
}));

vi.mock('../PaneShell', () => ({
  PaneShell: ({ children }: Props) => <div>{children}</div>,
}));

import { IntegrationPane } from '.';
import { parseIntegrationTaskUrl } from './parseIntegrationTaskUrl';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const CREATED_AT = '2026-07-22T12:00:00.000Z' as IsoDateTime;
const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'GB-42',
  identifier: 'GB-42',
  title: 'Refactor integration storage',
  url: 'https://linear.app/goodboy/issue/GB-42/refactor-integration-storage',
  createdAt: CREATED_AT,
};

beforeEach(() => {
  h.store.sessionExternalTasks = { [SESSION_ID]: [TASK] };
  h.store.workspaceIntegrations = {
    [WORKSPACE_ID]: [{ provider: 'linear' }, { provider: 'sentry' }],
  };
  h.store.linkSessionExternalTask.mockClear();
  h.store.unlinkSessionExternalTask.mockClear();
  h.openUrl.mockClear();
});

afterEach(cleanup);

describe('parseIntegrationTaskUrl', () => {
  it('parses provider URLs and falls back to their trailing segment', () => {
    expect(
      parseIntegrationTaskUrl({
        provider: 'linear',
        rawUrl: 'linear.app/goodboy/issue/GB-42/refactor-integration-storage',
      }),
    ).toMatchObject({ externalId: 'GB-42', identifier: 'GB-42', title: 'GB-42' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'sentry',
        rawUrl: 'https://sentry.io/organizations/goodboy/issues/12345/events/latest/',
      }),
    ).toMatchObject({ externalId: '12345', identifier: '12345' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'gitlab',
        rawUrl: 'https://gitlab.com/acme/web/-/issues/7',
      }),
    ).toMatchObject({ externalId: 'acme/web#7', identifier: 'acme/web#7' });
    expect(
      parseIntegrationTaskUrl({
        provider: 'linear',
        rawUrl: 'not a valid URL/item-9',
      }),
    ).toMatchObject({
      externalId: 'not a valid URL/item-9',
      identifier: 'item-9',
      url: 'not a valid URL/item-9',
    });
  });
});

describe('IntegrationPane', () => {
  it('opens and unlinks every provider task shown for the session', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByText('Refactor integration storage')).toBeDefined();
    expect(screen.getByText('Linear detail GB-42')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'open GB-42' }));
    expect(h.openUrl).toHaveBeenCalledWith(TASK.url);
    fireEvent.click(screen.getByRole('button', { name: 'unlink GB-42' }));
    await waitFor(() =>
      expect(h.store.unlinkSessionExternalTask).toHaveBeenCalledWith(SESSION_ID, 'linear', 'GB-42'),
    );
  });

  it('links a pasted provider URL', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Linear issue URL' }), {
      target: { value: 'https://linear.app/goodboy/issue/GB-99/new-link' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    await waitFor(() => expect(h.store.linkSessionExternalTask).toHaveBeenCalledOnce());
    expect(h.store.linkSessionExternalTask).toHaveBeenCalledWith(SESSION_ID, {
      provider: 'linear',
      externalId: 'GB-99',
      identifier: 'GB-99',
      title: 'GB-99',
      url: 'https://linear.app/goodboy/issue/GB-99/new-link',
      createdAt: expect.any(String),
    });
  });

  it('keeps the link form as the connected empty state and opens the provider studio', () => {
    h.store.sessionExternalTasks = {};
    const listener = vi.fn();
    window.addEventListener('goodboy:open-sentry-studio', listener);
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="sentry" />);

    expect(screen.getByRole('textbox', { name: 'Sentry issue URL' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open Sentry studio' }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-sentry-studio', listener);
  });

  it('shows a connect action instead of the link form when disconnected', () => {
    h.store.sessionExternalTasks = {};
    h.store.workspaceIntegrations = {};
    const listener = vi.fn();
    window.addEventListener('goodboy:open-settings', listener);

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByText('Connect Linear')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Linear issue URL' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-settings', listener);
  });
});
