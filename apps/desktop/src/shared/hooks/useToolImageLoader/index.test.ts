import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToolImageLoader } from './index';

const { loadRemoteImage, loadToolImage } = vi.hoisted(() => ({
  loadRemoteImage: vi.fn(async () => 'data:image/png;base64,remote'),
  loadToolImage: vi.fn(async () => 'data:image/png;base64,tool'),
}));

vi.mock('../../lib/remoteImage', () => ({ loadRemoteImage, loadToolImage }));

describe('useToolImageLoader', () => {
  beforeEach(() => {
    loadRemoteImage.mockClear();
    loadToolImage.mockClear();
  });

  it('auto loads only the urls the tool itself hosts', () => {
    const { result } = renderHook(() =>
      useToolImageLoader({ workspaceId: 'ws-1', provider: 'linear' }),
    );

    expect(result.current.shouldAutoLoad('https://uploads.linear.app/a.png')).toBe(true);
    expect(result.current.shouldAutoLoad('https://cdn.acme.dev/a.png')).toBe(false);
  });

  it('routes a tool-hosted url through the authed loader', async () => {
    const { result } = renderHook(() =>
      useToolImageLoader({ workspaceId: 'ws-1', provider: 'linear' }),
    );

    await result.current.load({ url: 'https://uploads.linear.app/a.png' });

    expect(loadToolImage).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: undefined,
      provider: 'linear',
      email: undefined,
      url: 'https://uploads.linear.app/a.png',
    });
    expect(loadRemoteImage).not.toHaveBeenCalled();
  });

  it('routes a foreign url through the anonymous loader', async () => {
    const { result } = renderHook(() =>
      useToolImageLoader({ workspaceId: 'ws-1', provider: 'linear' }),
    );

    await result.current.load({ url: 'https://cdn.acme.dev/a.png' });

    expect(loadRemoteImage).toHaveBeenCalledWith({ url: 'https://cdn.acme.dev/a.png' });
    expect(loadToolImage).not.toHaveBeenCalled();
  });

  it('recognizes each provider its own host', () => {
    const jira = renderHook(() => useToolImageLoader({ workspaceId: 'ws-1', provider: 'jira' }));
    expect(
      jira.result.current.shouldAutoLoad(
        'https://acme.atlassian.net/rest/api/3/attachment/content/1',
      ),
    ).toBe(true);
    expect(jira.result.current.shouldAutoLoad('https://acme.atlassian.net/other')).toBe(false);

    const github = renderHook(() =>
      useToolImageLoader({ workspaceId: 'ws-1', provider: 'github' }),
    );
    expect(
      github.result.current.shouldAutoLoad('https://github.com/user-attachments/assets/1'),
    ).toBe(true);
    expect(github.result.current.shouldAutoLoad('https://github.com/acme/repo')).toBe(false);
  });
});
