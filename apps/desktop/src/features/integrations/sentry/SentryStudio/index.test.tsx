import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  useSentryIssues: vi.fn(() => ({
    rows: [],
    loadMore: vi.fn(),
    hasMore: false,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

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

vi.mock('./useSentryIssues', () => ({
  useSentryIssues: h.useSentryIssues,
}));

import { SentryStudio } from '.';

afterEach(() => {
  cleanup();
  h.useSentryIssues.mockClear();
});

describe('SentryStudio', () => {
  it('renders the disconnected state without fetching issues', () => {
    const workspaceId = 'workspace-1' as WorkspaceId;
    render(<SentryStudio workspaceId={workspaceId} workspaceName="Goodboy" onClose={vi.fn()} />);

    expect(screen.getByText('Connect Sentry')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDefined();
    expect(h.useSentryIssues).toHaveBeenCalledWith(workspaceId, false);
  });
});
