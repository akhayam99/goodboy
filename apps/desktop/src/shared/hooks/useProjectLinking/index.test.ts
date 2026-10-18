// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    addProject: vi.fn(async () => undefined),
    removeProject: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));

import { useProjectLinking } from './index';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('useProjectLinking', () => {
  it('unlinks through the store and reports a failure inline', async () => {
    state.removeProject.mockRejectedValueOnce(new Error('database is locked'));
    const { result } = renderHook(() => useProjectLinking({ workspaceId: WORKSPACE_ID }));

    await act(() =>
      result.current.unlink({ project: { id: 'proj-1', name: 'ledger-core' } as never }),
    );

    expect(state.removeProject).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(result.current.error).toContain('database is locked');
  });
});
