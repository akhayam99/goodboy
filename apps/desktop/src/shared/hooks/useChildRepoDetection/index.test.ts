// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { repoLib } = vi.hoisted(() => ({
  repoLib: {
    validateGitRepo: vi.fn(),
    scanChildRepos: vi.fn(),
  },
}));

vi.mock('../../lib/repo', () => repoLib);

import { useChildRepoDetection } from './index';

beforeEach(() => {
  repoLib.validateGitRepo.mockReset();
  repoLib.scanChildRepos.mockReset().mockResolvedValue([]);
});

describe('useChildRepoDetection', () => {
  it('stays quiet when the picked folder is itself a repository', async () => {
    repoLib.validateGitRepo.mockResolvedValue({
      isRepo: true,
      rootPath: '/repos/api',
      resolvedPath: '/repos/api',
      error: null,
    });
    const { result } = renderHook(() => useChildRepoDetection());

    let outcome = false;
    await act(async () => {
      outcome = await result.current.detect({ path: '/repos/api' });
    });

    expect(outcome).toBe(false);
    expect(result.current.detected).toBeNull();
    expect(repoLib.scanChildRepos).not.toHaveBeenCalled();
  });

  it('detects direct child repositories under a plain folder', async () => {
    repoLib.validateGitRepo.mockResolvedValue({
      isRepo: false,
      rootPath: null,
      resolvedPath: '/repos/parent',
      error: 'not a git repository',
    });
    repoLib.scanChildRepos.mockResolvedValue([
      { name: 'api', path: '/repos/parent/api' },
      { name: 'web', path: '/repos/parent/web' },
    ]);
    const { result } = renderHook(() => useChildRepoDetection());

    let outcome = false;
    await act(async () => {
      outcome = await result.current.detect({ path: '/repos/parent' });
    });

    expect(outcome).toBe(true);
    expect(repoLib.scanChildRepos).toHaveBeenCalledWith({ path: '/repos/parent' });
    expect(result.current.detected).toEqual({
      parentPath: '/repos/parent',
      repos: [
        { name: 'api', path: '/repos/parent/api' },
        { name: 'web', path: '/repos/parent/web' },
      ],
    });
  });

  it('reports nothing when neither the folder nor its children hold a repository', async () => {
    repoLib.validateGitRepo.mockResolvedValue({
      isRepo: false,
      rootPath: null,
      resolvedPath: '/repos/plain',
      error: 'not a git repository',
    });
    const { result } = renderHook(() => useChildRepoDetection());

    let outcome = true;
    await act(async () => {
      outcome = await result.current.detect({ path: '/repos/plain' });
    });

    expect(outcome).toBe(false);
    expect(result.current.detected).toBeNull();
  });

  it('clears a previous detection on demand and on a new detect call', async () => {
    repoLib.validateGitRepo.mockResolvedValue({
      isRepo: false,
      rootPath: null,
      resolvedPath: '/repos/parent',
      error: 'not a git repository',
    });
    repoLib.scanChildRepos.mockResolvedValue([{ name: 'api', path: '/repos/parent/api' }]);
    const { result } = renderHook(() => useChildRepoDetection());

    await act(async () => {
      await result.current.detect({ path: '/repos/parent' });
    });
    expect(result.current.detected).not.toBeNull();

    act(() => {
      result.current.clear();
    });
    expect(result.current.detected).toBeNull();
  });
});
