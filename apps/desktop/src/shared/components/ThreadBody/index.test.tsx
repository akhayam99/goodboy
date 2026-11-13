// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ThreadBody } from './index';
import { ToolImageScope } from '../ToolImageScope';

const { loadToolImage, loadRemoteImage, probeToolMedia } = vi.hoisted(() => ({
  loadToolImage: vi.fn(async () => 'data:image/png;base64,tool'),
  loadRemoteImage: vi.fn(async () => 'data:image/png;base64,remote'),
  probeToolMedia: vi.fn(async () => 'image' as const),
}));

vi.mock('../../lib/remoteImage', () => ({ loadToolImage, loadRemoteImage, probeToolMedia }));

afterEach(cleanup);

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

const renderBody = (body: string) =>
  render(
    <ToolImageScope workspaceId="ws-1" provider="github">
      <ThreadBody body={body} isClamped={false} />
    </ToolImageScope>,
  );

describe('ThreadBody media', () => {
  it('loads an attachment of the pull request host through the connected account', async () => {
    const { container } = renderBody(
      '![board](https://github.com/user-attachments/assets/9f2c-thread)',
    );
    await flush();

    expect(loadToolImage).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', provider: 'github' }),
    );
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('keeps another host click to load', async () => {
    loadRemoteImage.mockClear();
    renderBody('![shot](https://cdn.acme.dev/shot.png)');
    await flush();

    expect(loadRemoteImage).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'Load' })).toHaveLength(1);
  });

  it('asks a bare attachment address its type once', async () => {
    probeToolMedia.mockClear();
    renderBody('https://github.com/user-attachments/assets/aaaa-bare-thread');
    await flush();
    await flush();

    expect(probeToolMedia).toHaveBeenCalledTimes(1);
  });
});
