// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ProjectId } from '@goodboy/types';
import { commitBaseBranch } from './commitBaseBranch';

const PROJECT_ID = 'proj-1' as ProjectId;

describe('commitBaseBranch', () => {
  it('trims and sets a new branch', async () => {
    const updateProjectBaseBranch = vi.fn(async () => undefined);
    await commitBaseBranch({
      projectId: PROJECT_ID,
      currentBaseBranch: null,
      candidate: '  develop  ',
      updateProjectBaseBranch,
    });
    expect(updateProjectBaseBranch).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      baseBranch: 'develop',
    });
  });

  it('clears to null on an empty candidate', async () => {
    const updateProjectBaseBranch = vi.fn(async () => undefined);
    await commitBaseBranch({
      projectId: PROJECT_ID,
      currentBaseBranch: 'develop',
      candidate: '',
      updateProjectBaseBranch,
    });
    expect(updateProjectBaseBranch).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      baseBranch: null,
    });
  });

  it('does nothing when the candidate matches the current branch', async () => {
    const updateProjectBaseBranch = vi.fn(async () => undefined);
    await commitBaseBranch({
      projectId: PROJECT_ID,
      currentBaseBranch: 'develop',
      candidate: 'develop',
      updateProjectBaseBranch,
    });
    expect(updateProjectBaseBranch).not.toHaveBeenCalled();
  });

  it('does nothing when clearing an already-auto branch', async () => {
    const updateProjectBaseBranch = vi.fn(async () => undefined);
    await commitBaseBranch({
      projectId: PROJECT_ID,
      currentBaseBranch: null,
      candidate: null,
      updateProjectBaseBranch,
    });
    expect(updateProjectBaseBranch).not.toHaveBeenCalled();
  });
});
