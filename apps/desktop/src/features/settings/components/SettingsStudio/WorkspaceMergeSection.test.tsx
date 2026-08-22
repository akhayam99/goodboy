// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, dbMocks, toastMock } = vi.hoisted(() => ({
  state: {
    mergeWorkspaces: vi.fn(async () => undefined),
  },
  dbMocks: {
    listWorkspaceMergeCandidates: vi.fn(async () => [] as ReadonlyArray<unknown>),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('@goodboy/db', () => dbMocks);
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { WorkspaceMergeSection } from './WorkspaceMergeSection';

const TARGET = 'ws-target' as WorkspaceId;

const candidates = [
  { id: 'ws-a', name: 'api', projectCount: 1, sessionCount: 3 },
  { id: 'ws-b', name: 'website', projectCount: 2, sessionCount: 0 },
];

beforeEach(() => {
  state.mergeWorkspaces = vi.fn(async () => undefined);
  dbMocks.listWorkspaceMergeCandidates = vi.fn(async () => candidates);
  toastMock.mockReset();
});
afterEach(cleanup);

describe('WorkspaceMergeSection', () => {
  it('lists the other workspaces with their project and session counts', async () => {
    render(<WorkspaceMergeSection workspaceId={TARGET} />);
    await waitFor(() => expect(screen.getByText('api')).toBeDefined());
    expect(screen.getByText('1 project · 3 sessions')).toBeDefined();
    expect(screen.getByText('2 projects · 0 sessions')).toBeDefined();
  });

  it('shows an empty hint when there is nothing to group', async () => {
    dbMocks.listWorkspaceMergeCandidates = vi.fn(async () => []);
    render(<WorkspaceMergeSection workspaceId={TARGET} />);
    await waitFor(() => expect(screen.getByText(/no other workspaces to group/i)).toBeDefined());
  });

  it('keeps the group action disabled until a workspace is selected', async () => {
    render(<WorkspaceMergeSection workspaceId={TARGET} />);
    await waitFor(() => expect(screen.getByText('api')).toBeDefined());
    const action = screen.getByRole('button', { name: /group into this workspace/i });
    expect(action.hasAttribute('disabled')).toBe(true);
  });

  it('merges only after the second, explicit confirmation click', async () => {
    render(<WorkspaceMergeSection workspaceId={TARGET} />);
    await waitFor(() => expect(screen.getByText('api')).toBeDefined());

    fireEvent.click(screen.getByRole('checkbox', { name: /api/i }));
    fireEvent.click(screen.getByRole('button', { name: /group 1 into this workspace/i }));
    expect(state.mergeWorkspaces).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirm merge of 1 workspace/i }));
    await waitFor(() =>
      expect(state.mergeWorkspaces).toHaveBeenCalledWith({
        sourceWorkspaceIds: ['ws-a'],
        targetWorkspaceId: TARGET,
      }),
    );
  });

  it('supports multi-select and reports the count in the confirmation', async () => {
    render(<WorkspaceMergeSection workspaceId={TARGET} />);
    await waitFor(() => expect(screen.getByText('api')).toBeDefined());

    fireEvent.click(screen.getByRole('checkbox', { name: /api/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /website/i }));
    fireEvent.click(screen.getByRole('button', { name: /group 2 into this workspace/i }));
    expect(screen.getByRole('button', { name: /confirm merge of 2 workspaces/i })).toBeDefined();
  });

  it('surfaces a merge failure inline', async () => {
    state.mergeWorkspaces = vi.fn(async () => {
      throw new Error('merge went sideways');
    });
    render(<WorkspaceMergeSection workspaceId={TARGET} />);
    await waitFor(() => expect(screen.getByText('api')).toBeDefined());

    fireEvent.click(screen.getByRole('checkbox', { name: /api/i }));
    fireEvent.click(screen.getByRole('button', { name: /group 1 into this workspace/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm merge of 1 workspace/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByRole('alert').textContent).toMatch(/merge went sideways/);
  });
});
