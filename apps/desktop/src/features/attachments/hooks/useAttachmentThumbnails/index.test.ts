// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { storySpies, stubStoryInvoke } from '../../../../store/storyHarness';
import { useAttachmentThumbnails, type ThumbnailSource } from '.';

type Pending = {
  readonly relPath: string;
  readonly resolve: (src: string) => void;
  readonly reject: (error: Error) => void;
};

type ReadArgs = {
  readonly relPath: string;
};

const pending: Array<Pending> = [];

const readAttachment = vi.fn(
  ({ relPath }: ReadArgs) =>
    new Promise<string>((resolve, reject) => {
      pending.push({ relPath, resolve, reject });
    }),
);

beforeEach(() => {
  pending.length = 0;
  readAttachment.mockClear();
  storySpies.tauriInvoke.mockClear();
  stubStoryInvoke({ attachment_read: readAttachment });
});

afterEach(cleanup);

type PathParams = {
  readonly relPath: string;
  readonly id?: string;
};

const source = ({ relPath, id = 'img-1' }: PathParams): ThumbnailSource => ({
  id,
  relPath,
  workingDir: '/worktrees/payments-api',
});

type NthParams = PathParams & {
  readonly index: number;
};

const pendingNth = ({ relPath, index }: NthParams): Pending => {
  const found = pending.filter((read) => read.relPath === relPath)[index];
  if (found === undefined) {
    throw new Error(`no pending read ${index} for ${relPath}`);
  }
  return found;
};

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

  it('drops the entry of an image that left the list, data included', async () => {
    const only = source({ relPath: 'a.png', id: 'a' });
    const both = [only, source({ relPath: 'b.png', id: 'b' })];
    const { result, rerender } = renderHook(({ sources }) => useAttachmentThumbnails({ sources }), {
      initialProps: { sources: both },
    });
    pendingFor({ relPath: 'a.png' }).resolve('data:a');
    pendingFor({ relPath: 'b.png' }).resolve('data:b');
    await waitFor(() => expect(Object.keys(result.current).sort()).toEqual(['a', 'b']));

    rerender({ sources: [only] });

    await waitFor(() => expect(Object.keys(result.current)).toEqual(['a']));
    expect(result.current['b']).toBeUndefined();
  });

  it('drops a read that finishes after its image left the list', async () => {
    const only = source({ relPath: 'a.png', id: 'a' });
    const both = [only, source({ relPath: 'b.png', id: 'b' })];
    const { result, rerender } = renderHook(({ sources }) => useAttachmentThumbnails({ sources }), {
      initialProps: { sources: both },
    });
    rerender({ sources: [only] });

    await act(async () => {
      pendingFor({ relPath: 'b.png' }).resolve('data:late');
      await Promise.resolve();
    });

    expect(result.current['b']).toBeUndefined();
    expect(Object.keys(result.current)).toEqual(['a']);
  });

  it('reads an image again when it comes back after leaving the list', async () => {
    const one = [source({ relPath: 'a.png', id: 'a' })];
    const { rerender } = renderHook(({ sources }) => useAttachmentThumbnails({ sources }), {
      initialProps: { sources: one },
    });
    rerender({ sources: [] });
    rerender({ sources: one });

    expect(readAttachment).toHaveBeenCalledTimes(2);
  });

  it('keeps the reopened read when the first opening fails late on the same path', async () => {
    const one = [source({ relPath: 'a.png', id: 'a' })];
    const { result, rerender } = renderHook(({ sources }) => useAttachmentThumbnails({ sources }), {
      initialProps: { sources: one },
    });
    rerender({ sources: [] });
    rerender({ sources: one });

    await act(async () => {
      pendingNth({ relPath: 'a.png', index: 1 }).resolve('data:new');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current['a']).toEqual({ status: 'ready', src: 'data:new' }));
    await act(async () => {
      pendingNth({ relPath: 'a.png', index: 0 }).reject(new Error('gone'));
      await Promise.resolve();
    });

    expect(result.current['a']).toEqual({ status: 'ready', src: 'data:new' });
  });

  it('keeps the reopened read when the first opening answers late on the same path', async () => {
    const one = [source({ relPath: 'a.png', id: 'a' })];
    const { result, rerender } = renderHook(({ sources }) => useAttachmentThumbnails({ sources }), {
      initialProps: { sources: one },
    });
    rerender({ sources: [] });
    rerender({ sources: one });

    await act(async () => {
      pendingNth({ relPath: 'a.png', index: 0 }).resolve('data:first');
      await Promise.resolve();
    });

    expect(result.current['a']).toEqual({ status: 'loading' });
    await act(async () => {
      pendingNth({ relPath: 'a.png', index: 1 }).resolve('data:new');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current['a']).toEqual({ status: 'ready', src: 'data:new' }));
  });
});
