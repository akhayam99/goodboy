// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: { workspaceIntegrations: Record<string, never[]> }) => T) =>
    selector({ workspaceIntegrations: {} }),
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({ children }: { children: (requestClose: () => void) => ReactNode }) => (
    <div>{children(vi.fn())}</div>
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

import { LinearStudio } from '.';

afterEach(cleanup);

describe('LinearStudio', () => {
  it('shows the connection state when Linear is disconnected', () => {
    render(
      <LinearStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Connect Linear')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined();
  });
});
