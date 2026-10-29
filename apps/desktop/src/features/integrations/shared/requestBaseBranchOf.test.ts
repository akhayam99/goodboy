// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  invoke: vi.fn(async (_name: string, _args: unknown): Promise<unknown> => ['origin']),
}));

vi.mock('../../../shared/lib/invokeCommand', () => ({
  invokeCommand: h.invoke,
}));

import { requestBaseBranchOf } from './requestBaseBranchOf';

beforeEach(() => {
  h.invoke.mockReset();
  h.invoke.mockResolvedValue(['origin']);
});

describe('requestBaseBranchOf', () => {
  it('turns a stored origin/main into main', async () => {
    const base = await requestBaseBranchOf({ candidates: ['origin/main'], cwd: '/repo' });

    expect(base).toBe('main');
    expect(h.invoke).toHaveBeenCalledWith('git_remote_names', { cwd: '/repo' });
  });

  it('turns upstream/develop into develop using the remotes the repository has', async () => {
    h.invoke.mockResolvedValue(['origin', 'upstream']);

    const base = await requestBaseBranchOf({ candidates: ['upstream/develop'], cwd: '/repo' });

    expect(base).toBe('develop');
  });

  it('takes the first candidate that holds a name', async () => {
    const base = await requestBaseBranchOf({
      candidates: [undefined, '  ', null, 'origin/release', 'main'],
      cwd: '/repo',
    });

    expect(base).toBe('release');
  });

  it('answers nothing when no candidate holds a name', async () => {
    const base = await requestBaseBranchOf({ candidates: [undefined, ''], cwd: '/repo' });

    expect(base).toBeUndefined();
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('falls back to origin when the remotes cannot be read', async () => {
    h.invoke.mockRejectedValue(new Error('no repository'));

    const base = await requestBaseBranchOf({ candidates: ['origin/main'], cwd: '/repo' });

    expect(base).toBe('main');
  });

  it('falls back to origin when the repository lists no remote', async () => {
    h.invoke.mockResolvedValue([]);

    const base = await requestBaseBranchOf({ candidates: ['origin/main'], cwd: '/repo' });

    expect(base).toBe('main');
  });
});
