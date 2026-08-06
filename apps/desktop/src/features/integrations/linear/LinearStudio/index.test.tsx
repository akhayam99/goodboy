// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../app/components/Toast';

const h = vi.hoisted(() => ({
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  disconnectLinear: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: {
      workspaceIntegrations: typeof h.integrations;
      disconnectLinear: typeof h.disconnectLinear;
    }) => T,
  ) => selector({ workspaceIntegrations: h.integrations, disconnectLinear: h.disconnectLinear }),
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

vi.mock('./useLinearIssues', () => ({
  useLinearIssues: () => ({
    groups: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('./IssueInbox', () => ({ IssueInbox: () => <div>Issue inbox</div> }));
vi.mock('./IssueDetailPanel', () => ({ IssueDetailPanel: () => <div>Issue detail</div> }));
vi.mock('../LinearFormBody', () => ({
  LinearFormBody: () => (
    <label htmlFor="linear-token-test">
      Personal access token
      <input id="linear-token-test" />
    </label>
  ),
}));

import { LinearStudio } from '.';

const renderStudio = () =>
  render(
    <ToastProvider>
      <LinearStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

afterEach(() => {
  cleanup();
  h.integrations = {};
  h.disconnectLinear.mockReset();
});

describe('LinearStudio', () => {
  it('shows the connection state when Linear is disconnected', () => {
    renderStudio();

    expect(screen.getByText('Connect Linear to review issues from this workspace')).toBeDefined();
    expect(screen.getByLabelText('Personal access token')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Disconnect Linear' })).toBeNull();
  });

  it('disconnects Linear from the header once connected', async () => {
    h.integrations = { 'workspace-1': [{ provider: 'linear' }] };

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Linear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Linear' }));

    await vi.waitFor(() => expect(h.disconnectLinear).toHaveBeenCalledWith('workspace-1'));
  });
});
