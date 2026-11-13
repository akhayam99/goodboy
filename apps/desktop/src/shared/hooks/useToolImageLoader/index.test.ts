import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToolImageLoader } from './index';

const { loadRemoteImage, loadToolImage, probeToolMedia } = vi.hoisted(() => ({
  probeToolMedia: vi.fn(async () => 'video' as const),
  loadRemoteImage: vi.fn(async () => 'data:image/png;base64,remote'),
  loadToolImage: vi.fn(async () => 'data:image/png;base64,tool'),
}));

vi.mock('../../lib/remoteImage', () => ({ loadRemoteImage, loadToolImage, probeToolMedia }));

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
      siteUrl: null,
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
    const jira = renderHook(() =>
      useToolImageLoader({
        workspaceId: 'ws-1',
        provider: 'jira',
        siteUrl: 'https://acme.atlassian.net',
      }),
    );
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

  it('refuses a jira attachment from a tenant other than the one connected', () => {
    const jira = renderHook(() =>
      useToolImageLoader({
        workspaceId: 'ws-1',
        provider: 'jira',
        siteUrl: 'https://acme.atlassian.net',
      }),
    );

    expect(
      jira.result.current.shouldAutoLoad(
        'https://evil.atlassian.net/rest/api/3/attachment/content/1',
      ),
    ).toBe(false);
  });

  it('never treats a jira attachment as its own host when no site is connected', () => {
    const jira = renderHook(() => useToolImageLoader({ workspaceId: 'ws-1', provider: 'jira' }));

    expect(
      jira.result.current.shouldAutoLoad(
        'https://acme.atlassian.net/rest/api/3/attachment/content/1',
      ),
    ).toBe(false);
  });

  it('asks the type of a github attachment with the workspace and project it names', async () => {
    const { result } = renderHook(() =>
      useToolImageLoader({ workspaceId: 'ws-1', projectId: 'pr-1', provider: 'github' }),
    );
    const url = 'https://github.com/user-attachments/assets/9f2c';

    expect(result.current.shouldAutoLoad(url)).toBe(true);
    await expect(result.current.probe({ url })).resolves.toBe('video');
    expect(probeToolMedia).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'pr-1',
      provider: 'github',
      email: undefined,
      siteUrl: null,
      url,
    });
  });
});
