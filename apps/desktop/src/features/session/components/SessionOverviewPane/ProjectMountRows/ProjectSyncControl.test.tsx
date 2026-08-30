// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { worktreeStatus, store } = vi.hoisted(() => ({
  worktreeStatus: vi.fn(),
  store: {
    setSessionActiveProject: vi.fn(async () => undefined),
    emitNotification: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock('../../../../worktree/worktree', () => ({ worktreeStatus }));
vi.mock('../../../hooks/useRebaseAgent', () => ({
  useRebaseAgent: () => ({ canRebase: false, isRunning: false, error: null, run: vi.fn() }),
}));
vi.mock('../../../hooks/usePushBranch', () => ({
  usePushBranch: () => ({ isBusy: false, error: null, run: vi.fn() }),
}));

import { ProjectSyncControl } from './ProjectSyncControl';

const renderControl = () =>
  render(
    <ProjectSyncControl
      sessionId={'session-1' as never}
      projectId={'project-1' as never}
      worktreePath="/worktree"
    />,
  );

describe('ProjectSyncControl', () => {
  beforeEach(() => {
    worktreeStatus.mockReset();
  });

  it('shows the behind badge only when behind is greater than zero', async () => {
    worktreeStatus.mockResolvedValue({
      mainDistance: { kind: 'known', ahead: 1, behind: 2 },
      upstreamDistance: { kind: 'known', ahead: 1, behind: 0 },
    });
    const view = renderControl();
    await waitFor(() => expect(screen.getByTestId('project-behind-badge').textContent).toBe('2'));

    view.unmount();
    worktreeStatus.mockResolvedValue({
      mainDistance: { kind: 'known', ahead: 1, behind: 0 },
      upstreamDistance: { kind: 'known', ahead: 1, behind: 0 },
    });
    renderControl();
    await waitFor(() => expect(worktreeStatus).toHaveBeenCalled());
    expect(screen.queryByTestId('project-behind-badge')).toBeNull();
  });
});
