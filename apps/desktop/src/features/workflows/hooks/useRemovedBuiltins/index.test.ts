// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Workflow, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  listRemovedSeededWorkflowIds: vi.fn(
    async (_db: unknown, _workspaceId: unknown): Promise<ReadonlyArray<string>> => [],
  ),
}));

vi.mock('@goodboy/db', () => ({ listRemovedSeededWorkflowIds: h.listRemovedSeededWorkflowIds }));
vi.mock('../../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { useRemovedBuiltins } from './index';

const WORKSPACE = 'ws-1' as WorkspaceId;
const NO_WORKFLOWS: ReadonlyArray<Workflow> = [];

afterEach(() => {
  cleanup();
  h.listRemovedSeededWorkflowIds.mockReset();
});

describe('useRemovedBuiltins', () => {
  it('returns the built-ins this workspace removed', async () => {
    h.listRemovedSeededWorkflowIds.mockResolvedValue(['wf_seed_fix-a-bug_ws-1']);

    const { result } = renderHook(() =>
      useRemovedBuiltins({ workspaceId: WORKSPACE, workflows: NO_WORKFLOWS }),
    );

    await waitFor(() => expect([...result.current]).toEqual(['wf_seed_fix-a-bug_ws-1']));
    expect(h.listRemovedSeededWorkflowIds).toHaveBeenCalledWith({}, WORKSPACE);
  });

  it('reads as nothing removed when the query fails', async () => {
    h.listRemovedSeededWorkflowIds.mockRejectedValue(new Error('database busy'));

    const { result } = renderHook(() =>
      useRemovedBuiltins({ workspaceId: WORKSPACE, workflows: NO_WORKFLOWS }),
    );

    await waitFor(() => expect(h.listRemovedSeededWorkflowIds).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});
