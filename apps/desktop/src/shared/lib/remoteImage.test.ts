import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { loadRemoteImage, loadToolImage } from './remoteImage';

describe('loadRemoteImage', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
  });

  it('asks the backend for the url it was given and nothing else', async () => {
    await loadRemoteImage({ url: 'https://one.example.com/board.png?token=abc' });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('fetch_remote_image', {
      url: 'https://one.example.com/board.png?token=abc',
    });
  });

  it('returns the data uri the backend answers with', async () => {
    const uri = await loadRemoteImage({ url: 'https://two.example.com/a.png' });

    expect(uri).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('lets a refusal from the backend reach the caller', async () => {
    invoke.mockRejectedValue('example.com points at a private address, so nothing was loaded');

    await expect(loadRemoteImage({ url: 'https://example.com/a.png' })).rejects.toBe(
      'example.com points at a private address, so nothing was loaded',
    );
  });
});

describe('loadToolImage', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
  });

  it('asks the backend with the workspace, provider and email it was given', async () => {
    await loadToolImage({
      workspaceId: 'ws-1',
      projectId: 'proj-1',
      provider: 'jira',
      email: 'mara@acme.dev',
      url: 'https://acme.atlassian.net/rest/api/3/attachment/content/1',
    });

    expect(invoke).toHaveBeenCalledWith('load_tool_image', {
      workspaceId: 'ws-1',
      projectId: 'proj-1',
      provider: 'jira',
      email: 'mara@acme.dev',
      url: 'https://acme.atlassian.net/rest/api/3/attachment/content/1',
    });
  });

  it('sends null for the fields a provider does not need', async () => {
    await loadToolImage({
      workspaceId: 'ws-1',
      provider: 'linear',
      url: 'https://uploads.linear.app/a.png',
    });

    expect(invoke).toHaveBeenCalledWith('load_tool_image', {
      workspaceId: 'ws-1',
      projectId: null,
      provider: 'linear',
      email: null,
      url: 'https://uploads.linear.app/a.png',
    });
  });
});
