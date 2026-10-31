// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAttachmentThumbnails, type ThumbnailSource } from '.';

type Pending = {
  readonly relPath: string;
  readonly resolve: (src: string) => void;
};

const { pending, readAttachment } = vi.hoisted(() => {
  const pendingReads: Array<{ relPath: string; resolve: (src: string) => void }> = [];
  return {
    pending: pendingReads,
    readAttachment: vi.fn(
      (_dir: string, relPath: string) =>
        new Promise<string>((resolve) => {
          pendingReads.push({ relPath, resolve });
        }),
    ),
  };
});

vi.mock('../../../chat/turn', () => ({ readAttachment }));

beforeEach(() => {
  pending.length = 0;
  readAttachment.mockClear();
});

afterEach(cleanup);

type PathParams = {
  readonly relPath: string;
};

const source = ({ relPath }: PathParams): ThumbnailSource => ({
  id: 'img-1',
  relPath,
  workingDir: '/worktrees/payments-api',
});

const pendingFor = ({ relPath }: PathParams): Pending => {
  const found = pending.find((read) => read.relPath === relPath);
  if (found === undefined) {
    throw new Error(`no pending read for ${relPath}`);
  }
  return found;
};

describe('useAttachmentThumbnails', () => {
  it('keeps the answer of the latest path and drops a late answer for the old one', async () => {
    const { result, rerender } = renderHook(
      ({ relPath }) => useAttachmentThumbnails({ sources: [source({ relPath })] }),
      { initialProps: { relPath: 'old.png' } },
    );
    rerender({ relPath: 'new.png' });

    pendingFor({ relPath: 'new.png' }).resolve('data:new');
    await waitFor(() =>
      expect(result.current['img-1']).toEqual({ status: 'ready', src: 'data:new' }),
    );
    pendingFor({ relPath: 'old.png' }).resolve('data:old');

    await Promise.resolve();
    expect(result.current['img-1']).toEqual({ status: 'ready', src: 'data:new' });
  });

  it('treats an empty answer as a failed read, never as an image source', async () => {
    const { result } = renderHook(() =>
      useAttachmentThumbnails({ sources: [source({ relPath: 'empty.png' })] }),
    );

    pendingFor({ relPath: 'empty.png' }).resolve('');

    await waitFor(() => expect(result.current['img-1']).toEqual({ status: 'failed' }));
  });

  it('reads a path once however often the list is rebuilt', async () => {
    const { rerender } = renderHook(() =>
      useAttachmentThumbnails({ sources: [source({ relPath: 'same.png' })] }),
    );
    rerender();
    rerender();

    expect(readAttachment).toHaveBeenCalledTimes(1);
  });
});
