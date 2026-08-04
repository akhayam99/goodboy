// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';

type Store = {
  readonly sessionExternalTasks: Readonly<Record<string, ReadonlyArray<SessionExternalTask>>>;
  readonly workspaceIntegrations: Readonly<Record<string, ReadonlyArray<{ provider: string }>>>;
  readonly sessions: ReadonlyArray<{ id: string; workspaceId: string }>;
  readonly linkSessionExternalTask: ReturnType<typeof vi.fn>;
  readonly unlinkSessionExternalTask: ReturnType<typeof vi.fn>;
  readonly connectLinear: ReturnType<typeof vi.fn>;
  readonly disconnectLinear: ReturnType<typeof vi.fn>;
};

type Props = {
  readonly children: ReactNode;
  readonly actions?: ReactNode;
};

type TaskDetailProps = {
  readonly task: SessionExternalTask;
  readonly headerActions: ReactNode;
};

const h = vi.hoisted(() => ({
  store: {
    sessionExternalTasks: {},
    workspaceIntegrations: {},
    sessions: [],
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
  LinearTaskDetail: ({ task, headerActions }: TaskDetailProps) => (
    <div data-testid="task-detail">
      {headerActions}
      <a href="https://linear.app/GB-42" aria-label="Open in Linear">
        Linear detail {task.externalId}
      </a>
      <button type="button" aria-label="Copy issue link" />
    </div>
  ),
}));

vi.mock('./SentryTaskDetail', () => ({
  SentryTaskDetail: ({ task, headerActions }: TaskDetailProps) => (
    <div data-testid="task-detail">
      {headerActions}
      <a href="https://sentry.io/issues/12345" aria-label="Open in Sentry">
        Sentry detail {task.externalId}
      </a>
      <button type="button" aria-label="Copy issue link" />
    </div>
  ),
}));

vi.mock('../../../../../../shared/components/PaneShell', () => ({
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
const SECOND_TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'GB-43',
  identifier: 'GB-43',
  title: 'Trim the integration pane',
  url: 'https://linear.app/goodboy/issue/GB-43/trim-the-integration-pane',
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
  it.each([
    ['linear', TASK, 'Linear'],
    ['sentry', SENTRY_TASK, 'Sentry'],
  ] as const)(
    'shows one open and copy affordance for a linked %s task with detail',
    (provider, task, host) => {
      h.store.sessionExternalTasks = { [SESSION_ID]: [task] };

      render(
        <IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider={provider} />,
      );

      expect(screen.getAllByRole('link', { name: `Open in ${host}` })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Copy issue link' })).toHaveLength(1);
    },
  );

  it('auto-focuses the only linked task instead of listing it', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByText('Linear detail GB-42')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'View GB-42' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All issues' })).toBeNull();
  });

  it('hands the focused actions to the detail header instead of stacking a pane header', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    const detail = screen.getByTestId('task-detail');

    expect(within(detail).getByRole('button', { name: 'Unlink GB-42' })).toBeDefined();
    expect(within(detail).getByRole('button', { name: 'Link issue' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Unlink GB-42' })).toHaveLength(1);
  });

  it('lists every linked task as a card and focuses the clicked one', () => {
    h.store.sessionExternalTasks = { [SESSION_ID]: [TASK, SECOND_TASK] };

    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getAllByRole('button', { name: /^View GB-/ })).toHaveLength(2);
    expect(screen.getByText('Trim the integration pane')).toBeDefined();
    expect(screen.queryByText('Linear detail GB-42')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View GB-43' }));

    expect(screen.getByText('Linear detail GB-43')).toBeDefined();
    expect(screen.getByRole('button', { name: 'All issues' })).toBeDefined();
  });

  it('opens and confirms before unlinking the focused task', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    expect(screen.getByText('Linear detail GB-42')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink GB-42' }));
    expect(h.store.unlinkSessionExternalTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink GB-42' }));
    await waitFor(() =>
      expect(h.store.unlinkSessionExternalTask).toHaveBeenCalledWith(SESSION_ID, 'linear', 'GB-42'),
    );
  });

  it('links a pasted provider URL from the picker and closes the popover', async () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);

    fireEvent.click(screen.getByRole('button', { name: 'Link issue' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Link an issue' }), {
      target: { value: 'https://linear.app/goodboy/issue/GB-99/new-link' },
    });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Link GB-99' }));

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
      expect(screen.queryByRole('dialog', { name: 'link Linear issue' })).toBeNull(),
    );
  });

  it('keeps the connected empty state to a single link affordance', () => {
    h.store.sessionExternalTasks = {};
    const listener = vi.fn();
    window.addEventListener('goodboy:open-sentry-studio', listener);
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="sentry" />);

    expect(screen.getByText('No Sentry issues linked')).toBeDefined();
    expect(screen.queryByRole('combobox', { name: 'Link an issue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Sentry studio' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Link issue' }));

    expect(screen.getByRole('dialog', { name: 'Link Sentry issue' })).toBeDefined();
    expect(screen.getByRole('combobox', { name: 'Link an issue' })).toBeDefined();
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
    expect(screen.queryByRole('combobox', { name: 'Link an issue' })).toBeNull();
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

    fireEvent.click(screen.getByRole('button', { name: 'Link issue' }));
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

  it('links nothing when Enter is pressed in a closed issue picker', () => {
    render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);
    fireEvent.click(screen.getByRole('button', { name: 'Link issue' }));
    const picker = screen.getByRole('combobox', { name: 'Link an issue' });

    fireEvent.focus(picker);
    fireEvent.keyDown(picker, { key: 'Escape' });
    fireEvent.keyDown(picker, { key: 'Enter' });

    expect(h.store.linkSessionExternalTask).not.toHaveBeenCalled();
  });
});
