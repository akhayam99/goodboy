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
  readonly connectLinear: ReturnType<typeof vi.fn>;
  readonly disconnectLinear: ReturnType<typeof vi.fn>;
};

type Props = {
  readonly children: ReactNode;
  readonly actions?: ReactNode;
};

const h = vi.hoisted(() => ({
  store: {
    sessionExternalTasks: {},
    workspaceIntegrations: {},
    linkSessionExternalTask: vi.fn(async () => undefined),
    unlinkSessionExternalTask: vi.fn(async () => undefined),
    connectLinear: vi.fn(async () => undefined),
    disconnectLinear: vi.fn(async () => undefined),
  },
  openUrl: vi.fn(async () => undefined),
  loadCandidates: vi.fn(),
  candidate: {
    provider: 'linear',
    externalId: 'GB-77',
    identifier: 'GB-77',
    title: 'Ship the issue picker',
    url: 'https://linear.app/goodboy/issue/GB-77/ship-the-issue-picker',
    goal: 'Ship the issue picker',
    branchSlug: 'ship-the-issue-picker',
  },
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
  PaneShell: ({ children, actions }: Props) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

vi.mock('../../../../../integrations/hooks/useIssueCandidates', () => ({
  useIssueCandidates: () => ({
    rows: [h.candidate],
    isLoading: false,
    isLoaded: true,
    error: null,
    load: h.loadCandidates,
  }),
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
const SENTRY_TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'sentry',
  externalId: '12345',
  identifier: 'GOODBOY-5',
  title: 'Request failed',
  url: 'https://sentry.io/organizations/goodboy/issues/12345/',
  createdAt: CREATED_AT,
};

beforeEach(() => {
  h.store.sessionExternalTasks = { [SESSION_ID]: [TASK] };
  h.store.workspaceIntegrations = {
    [WORKSPACE_ID]: [{ provider: 'linear' }, { provider: 'sentry' }],
  };
  h.store.linkSessionExternalTask.mockClear();
  h.store.unlinkSessionExternalTask.mockClear();
  h.store.connectLinear.mockClear();
  h.store.disconnectLinear.mockClear();
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
  it('opens and confirms before unlinking every provider task shown for the session', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByText('Refactor integration storage')).toBeDefined();
    expect(screen.getByText('Linear detail GB-42')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'open GB-42' }));
    expect(h.openUrl).toHaveBeenCalledWith(TASK.url);
    fireEvent.click(screen.getByRole('button', { name: 'unlink GB-42' }));
    expect(h.store.unlinkSessionExternalTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink GB-42' }));
    await waitFor(() =>
      expect(h.store.unlinkSessionExternalTask).toHaveBeenCalledWith(SESSION_ID, 'linear', 'GB-42'),
    );
  });

  it('links a pasted provider URL from the Link ticket popover and closes it', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    fireEvent.click(screen.getByRole('button', { name: 'Link ticket' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Or paste a Linear issue URL' }), {
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
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'link Linear ticket' })).toBeNull(),
    );
  });

  it('shows the Link ticket action only when a task is already linked', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.queryByRole('textbox', { name: 'Or paste a Linear issue URL' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Link ticket' }));
    expect(screen.getByRole('dialog', { name: 'link Linear ticket' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Or paste a Linear issue URL' })).toBeDefined();

    cleanup();
    h.store.sessionExternalTasks = {};
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);
    expect(screen.queryByRole('button', { name: 'Link ticket' })).toBeNull();
  });

  it('integrates only the link form into the connected empty state', () => {
    h.store.sessionExternalTasks = {};
    const listener = vi.fn();
    window.addEventListener('goodboy:open-sentry-studio', listener);
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="sentry" />);

    expect(screen.getByText('No Sentry issues linked')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Or paste a Sentry issue URL' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Link ticket' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Sentry studio' })).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-sentry-studio', listener);
  });

  it('shows the provider connection form inline when disconnected', async () => {
    h.store.sessionExternalTasks = {};
    h.store.workspaceIntegrations = {};
    const listener = vi.fn();
    window.addEventListener('goodboy:open-linear-studio', listener);

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByText('Linear')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Or paste a Linear issue URL' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Personal access token'), {
      target: { value: 'lin_api_test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(h.store.connectLinear).toHaveBeenCalledWith(WORKSPACE_ID, 'lin_api_test'),
    );
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:open-linear-studio', listener);
  });

  it.each([
    ['linear', TASK, 'Linear detail GB-42'],
    ['sentry', SENTRY_TASK, 'Sentry detail 12345'],
  ] as const)(
    'keeps linked %s rows without rendering live detail while disconnected',
    (provider, task, detailText) => {
      h.store.sessionExternalTasks = { [SESSION_ID]: [task] };
      h.store.workspaceIntegrations = {};

      render(
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider={provider} />,
      );

      expect(screen.getByText(task.title)).toBeDefined();
      expect(screen.queryByText(detailText)).toBeNull();
    },
  );

  it('links an issue picked from the assigned-issues search', async () => {
    h.store.workspaceIntegrations = { [WORKSPACE_ID]: [{ provider: 'linear' }] };

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    fireEvent.click(screen.getByRole('button', { name: 'Link ticket' }));
    fireEvent.focus(screen.getByRole('combobox', { name: 'Link an issue' }));
    fireEvent.mouseDown(screen.getByText('Ship the issue picker'));

    await waitFor(() => expect(h.store.linkSessionExternalTask).toHaveBeenCalledOnce());
    expect(h.store.linkSessionExternalTask).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        provider: 'linear',
        externalId: 'GB-77',
        identifier: 'GB-77',
        title: 'Ship the issue picker',
        url: 'https://linear.app/goodboy/issue/GB-77/ship-the-issue-picker',
      }),
    );
  });

  it('does not submit the URL form when Enter is pressed in a closed issue picker', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);
    fireEvent.click(screen.getByRole('button', { name: 'Link ticket' }));
    const picker = screen.getByRole('combobox', { name: 'Link an issue' });

    fireEvent.focus(picker);
    fireEvent.keyDown(picker, { key: 'Escape' });
    fireEvent.keyDown(picker, { key: 'Enter' });

    expect(h.store.linkSessionExternalTask).not.toHaveBeenCalled();
    expect(screen.queryByText('Paste an issue URL to link it.')).toBeNull();
  });
});
