// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../app/components/Toast';
import type { JiraIssue } from '../client';

const h = vi.hoisted(() => ({
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  groups: [] as ReadonlyArray<unknown>,
  lastParams: null as { assignedOnly: boolean } | null,
  disconnectJira: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: {
      workspaceIntegrations: typeof h.integrations;
      disconnectJira: typeof h.disconnectJira;
    }) => T,
  ) => selector({ workspaceIntegrations: h.integrations, disconnectJira: h.disconnectJira }),
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    headerAccessory,
  }: {
    children: (requestClose: () => void) => ReactNode;
    headerAccessory: ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

vi.mock('./useJiraIssues', () => ({
  useJiraIssues: (params: { assignedOnly: boolean }) => {
    h.lastParams = params;
    return { groups: h.groups, isLoading: false, error: null, refetch: vi.fn() };
  },
}));

vi.mock('./IssueDetailPanel', () => ({
  IssueDetailPanel: ({ issue }: { issue: JiraIssue | null }) => (
    <div data-testid="detail">{issue?.key ?? 'none'}</div>
  ),
}));

vi.mock('../JiraFormBody', () => ({
  JiraFormBody: () => (
    <label htmlFor="jira-token-test">
      API token
      <input id="jira-token-test" />
    </label>
  ),
}));

import { JiraStudio } from '.';

const ISSUE = { id: '10042', key: 'ENG-142', summary: 'Session rail drops focus' } as JiraIssue;

const renderStudio = () =>
  render(
    <ToastProvider>
      <JiraStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  h.integrations = {};
  h.groups = [];
  h.lastParams = null;
});
afterEach(() => {
  cleanup();
  h.disconnectJira.mockReset();
});

describe('JiraStudio', () => {
  it('asks for the connection before showing an inbox', () => {
    renderStudio();

    expect(screen.getByText('Connect Jira to review issues from this workspace')).toBeDefined();
    expect(screen.getByLabelText('API token')).toBeDefined();
  });

  it('focuses the first issue of the inbox and queries only assigned issues by default', () => {
    h.integrations = { 'workspace-1': [{ provider: 'jira' }] };
    h.groups = [{ key: 'new', label: 'To do', rows: [{ issue: ISSUE, sessionId: null }] }];

    renderStudio();

    expect(screen.getByTestId('detail').textContent).toBe('ENG-142');
    expect(h.lastParams?.assignedOnly).toBe(true);
  });

  it('disconnects Jira from the header once connected', async () => {
    h.integrations = { 'workspace-1': [{ provider: 'jira' }] };

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Jira' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Jira' }));

    await vi.waitFor(() =>
      expect(h.disconnectJira).toHaveBeenCalledWith({ workspaceId: 'workspace-1' }),
    );
  });
});
