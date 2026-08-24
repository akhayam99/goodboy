import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../app/components/Toast';

const h = vi.hoisted(() => ({
  useSentryIssues: vi.fn(() => ({
    rows: [],
    loadMore: vi.fn(),
    hasMore: false,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  disconnectIntegration: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: {
      workspaceIntegrations: typeof h.integrations;
      disconnectIntegration: typeof h.disconnectIntegration;
    }) => T,
  ) =>
    selector({
      workspaceIntegrations: h.integrations,
      disconnectIntegration: h.disconnectIntegration,
    }),
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    headerAccessory,
  }: {
    children: (requestClose: () => void) => ReactNode;
    headerAccessory?: ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

vi.mock('./useSentryIssues', () => ({
  useSentryIssues: h.useSentryIssues,
}));
vi.mock('./IssueInbox', () => ({ IssueInbox: () => <div>Issue inbox</div> }));
vi.mock('./IssueDetailPanel', () => ({ IssueDetailPanel: () => <div>Issue detail</div> }));
vi.mock('../SentryFormBody', () => ({
  SentryFormBody: () => (
    <div>
      <label htmlFor="sentry-token-test">Auth token</label>
      <input id="sentry-token-test" />
      <label htmlFor="sentry-project-test">Project slug</label>
      <input id="sentry-project-test" />
    </div>
  ),
}));

import { SentryStudio } from '.';

const renderStudio = () =>
  render(
    <ToastProvider>
      <SentryStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  h.useSentryIssues.mockClear();
  h.integrations = {};
  h.disconnectIntegration.mockReset();
});

describe('SentryStudio', () => {
  it('renders the disconnected state without fetching issues', () => {
    const workspaceId = 'workspace-1' as WorkspaceId;
    renderStudio();

    expect(screen.getByText('Connect Sentry to review errors from this project')).toBeDefined();
    expect(screen.getByLabelText('Auth token')).toBeDefined();
    expect(screen.getByLabelText('Project slug')).toBeDefined();
    expect(h.useSentryIssues).toHaveBeenCalledWith(workspaceId, false);
    expect(screen.queryByRole('button', { name: 'Disconnect Sentry' })).toBeNull();
  });

  it('disconnects Sentry from the header once connected', async () => {
    h.integrations = { 'workspace-1': [{ provider: 'sentry' }] };

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Sentry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Sentry' }));

    await vi.waitFor(() =>
      expect(h.disconnectIntegration).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        provider: 'sentry',
      }),
    );
  });
});
