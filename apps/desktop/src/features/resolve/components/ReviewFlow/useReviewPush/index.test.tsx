// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type MountId, type ResolvePublicationPreview } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  SESSION,
  seedResolveScene,
} from '../../../../../app/components/MockScene/scenes/resolveSeed';
import { useReviewPush } from './index';

const MOUNT_LEDGER = brandId<MountId>({ value: 'mount-ledger-core' });
const MOUNT_PAYMENTS = brandId<MountId>({ value: 'mount-payments-api' });

const PREVIEW: ResolvePublicationPreview = {
  publicationId: 'pub-ledger',
  repo: 'harborline/ledger-core',
  prNumber: 12,
  branch: 'hl/ledger-core',
  localHead: 'a41c9e2aaaa',
  remoteHead: '7d02b11bbbb',
  requiresPush: true,
  frozenAt: 1,
  commits: [
    {
      sha: 'a41c9e2aaaa',
      shortSha: 'a41c9e2',
      subject: 'Round half to even',
      author: 'resolver',
      timestamp: 1,
      pushed: false,
      parentSha: null,
      threadIds: [],
    },
  ],
  unapproved: [],
  replies: [],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
};

let useAppStore: StoryStore;
let prepare = vi.fn(async (..._args: ReadonlyArray<unknown>) => PREVIEW);
let retry = vi.fn(async (..._args: ReadonlyArray<unknown>) => PREVIEW);
let cancel = vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
  prepare = vi.fn(async () => PREVIEW);
  retry = vi.fn(async () => PREVIEW);
  cancel = vi.fn(async () => undefined);
  useAppStore.setState({
    preparePublication: prepare,
    retryPublication: retry,
    cancelPublication: cancel,
  });
});

afterEach(cleanup);

describe('useReviewPush on a page that shows one mount', () => {
  it('prepares the push for the mount on screen', async () => {
    const { result } = renderHook(() =>
      useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }),
    );

    await act(async () => {
      await result.current.press({ isRetry: false });
    });

    expect(prepare).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT_LEDGER });
    expect(result.current.phase.kind).toBe('confirm');
  });

  it('retries the push for the mount on screen', async () => {
    const { result } = renderHook(() =>
      useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }),
    );

    await act(async () => {
      await result.current.press({ isRetry: true });
    });

    expect(retry).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT_LEDGER });
  });

  it('closes an open confirm when the page moves to another mount', async () => {
    const { result, rerender } = renderHook(
      ({ mountId }: { readonly mountId: MountId }) =>
        useReviewPush({ sessionId: SESSION.id, mountId }),
      { initialProps: { mountId: MOUNT_LEDGER } },
    );
    await act(async () => {
      await result.current.press({ isRetry: false });
    });
    expect(result.current.phase.kind).toBe('confirm');

    rerender({ mountId: MOUNT_PAYMENTS });

    expect(result.current.phase.kind).toBe('idle');
    expect(cancel).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: 'pub-ledger' });
  });

  it('drops a late preview for the mount the page left', async () => {
    let open: (preview: ResolvePublicationPreview) => void = () => undefined;
    prepare.mockImplementationOnce(
      () =>
        new Promise<ResolvePublicationPreview>((resolve) => {
          open = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ mountId }: { readonly mountId: MountId }) =>
        useReviewPush({ sessionId: SESSION.id, mountId }),
      { initialProps: { mountId: MOUNT_LEDGER } },
    );
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.press({ isRetry: false });
    });
    expect(result.current.phase.kind).toBe('preparing');

    rerender({ mountId: MOUNT_PAYMENTS });
    await act(async () => {
      open(PREVIEW);
      await pending;
    });

    expect(result.current.phase.kind).toBe('idle');
    expect(cancel).toHaveBeenCalledWith({ sessionId: SESSION.id, publicationId: 'pub-ledger' });
  });
});
