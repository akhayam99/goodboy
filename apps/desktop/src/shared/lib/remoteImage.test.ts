import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { loadRemoteImage } from './remoteImage';

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
