// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { RemoteImage } from '@goodboy/ui';
import { ToolImageScope } from './index';

const { loadToolImage } = vi.hoisted(() => ({
  loadToolImage: vi.fn(async () => 'data:image/png;base64,tool'),
}));

vi.mock('../../lib/remoteImage', () => ({
  loadRemoteImage: vi.fn(async () => 'data:image/png;base64,remote'),
  loadToolImage,
}));

afterEach(cleanup);

describe('ToolImageScope', () => {
  it('auto loads an image hosted by the connected tool', async () => {
    render(
      <ToolImageScope workspaceId="ws-1" provider="linear">
        <RemoteImage url="https://uploads.linear.app/a.png" alt="board" />
      </ToolImageScope>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByRole('img', { name: 'board' })).toBeDefined();
    expect(loadToolImage).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: undefined,
      provider: 'linear',
      email: undefined,
      siteUrl: null,
      url: 'https://uploads.linear.app/a.png',
    });
  });
});
