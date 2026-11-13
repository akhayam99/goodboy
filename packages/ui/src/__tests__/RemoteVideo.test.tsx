// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RemoteImageLoaderProvider } from '../components/RemoteImage/RemoteImageLoaderProvider';
import type { RemoteVideoFile } from '../components/RemoteImage/loaderContext';
import { RemoteVideo } from '../components/RemoteVideo';

const URL_OF_VIDEO = 'https://github.com/user-attachments/assets/9f2c-acme';
const FILE: RemoteVideoFile = {
  blob: new Blob([new Uint8Array(8)], { type: 'video/mp4' }),
  bytes: 4_400_000,
};

const createObjectURL = vi.fn(() => 'blob:harborline-1');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
});

afterEach(cleanup);

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

type Params = {
  readonly loadVideo?: () => Promise<RemoteVideoFile>;
  readonly onOpen?: (url: string) => void;
};

const renderVideo = ({ loadVideo, onOpen }: Params) =>
  render(
    <RemoteImageLoaderProvider load={vi.fn()} loadVideo={loadVideo} onOpen={onOpen}>
      <RemoteVideo url={URL_OF_VIDEO} />
    </RemoteImageLoaderProvider>,
  );

describe('RemoteVideo', () => {
  it('fetches nothing until play and fetches once per play', async () => {
    const loadVideo = vi.fn().mockResolvedValue(FILE);
    const { container } = renderVideo({ loadVideo });
    await flush();
    expect(loadVideo).not.toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();

    const play = screen.getByRole('button', { name: 'Play' });
    fireEvent.click(play);
    fireEvent.click(play);
    await flush();

    expect(loadVideo).toHaveBeenCalledTimes(1);
    expect(container.querySelector('video')?.getAttribute('src')).toBe('blob:harborline-1');
    expect(screen.queryByText('4.2 MB')).not.toBeNull();
  });

  it('shows a skeleton while the fetch is pending and no player yet', async () => {
    const loadVideo = vi.fn().mockReturnValue(new Promise(() => undefined));
    const { container } = renderVideo({ loadVideo });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();

    expect(screen.queryByRole('status')).not.toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('releases the blob on unmount', async () => {
    const loadVideo = vi.fn().mockResolvedValue(FILE);
    const { unmount } = renderVideo({ loadVideo });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:harborline-1');
  });

  it('drops a body that lands after the page closed', async () => {
    let resolveLoad: (file: RemoteVideoFile) => void = () => undefined;
    const loadVideo = vi.fn().mockReturnValue(
      new Promise<RemoteVideoFile>((resolve) => {
        resolveLoad = resolve;
      }),
    );
    const { unmount } = renderVideo({ loadVideo });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    unmount();
    resolveLoad(FILE);
    await flush();

    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('shows the reason and the way out on a refusal, and retries on the play button', async () => {
    const onOpen = vi.fn();
    const loadVideo = vi
      .fn()
      .mockRejectedValueOnce(new Error('that video is larger than 50 MB, so nothing was loaded'))
      .mockResolvedValueOnce(FILE);
    const { container } = renderVideo({ loadVideo, onOpen });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await flush();

    expect(screen.queryByText(/larger than 50 MB/)).not.toBeNull();
    expect(container.querySelector('video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open on the host' }));
    expect(onOpen).toHaveBeenCalledWith(URL_OF_VIDEO);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();

    expect(loadVideo).toHaveBeenCalledTimes(2);
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('keeps the poster with only the way out when nothing can fetch', () => {
    const onOpen = vi.fn();
    renderVideo({ onOpen });

    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open on the host' })).not.toBeNull();
  });
});
