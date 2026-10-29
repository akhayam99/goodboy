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

  it('says nothing is waiting only when the last push did not fail', async () => {
    retry.mockResolvedValueOnce({ ...PREVIEW, publicationId: null, commits: [] });
    const { result } = renderHook(() =>
      useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }),
    );

    await act(async () => {
      await result.current.press({ isRetry: true });
    });

    expect(result.current.phase).toEqual({
      kind: 'result',
      result: { tone: 'done', sentence: 'Nothing is waiting for the push.' },
    });
  });

  it('shows the failed push, its check and an agent target when the retry finds nothing new', async () => {
    const error = '$ yarn knip --cache\nUnused files (15)\nerror: failed to push some refs';
    useAppStore.setState({
      sessionResolvePublications: {
        [SESSION.id]: [
          {
            id: 'pub-ledger',
            sessionId: SESSION.id,
            repo: 'harborline/ledger-core',
            prNumber: 12,
            branch: 'hl/ledger-core',
            targetRef: 'main',
            localHead: 'a41c9e2aaaa',
            remoteHead: '7d02b11bbbb',
            commitShas: ['a41c9e2aaaa', 'b52d0f3bbbb'],
            candidateIds: [],
            approvedItemIds: [],
            requiresPush: true,
            mountTarget: null,
            phase: 'failed',
            pushedHead: null,
            confirmedAt: 2,
            completedAt: 3,
            holder: null,
            heartbeatAt: null,
            error,
            createdAt: 1,
          },
        ],
      },
    });
    retry.mockResolvedValueOnce({ ...PREVIEW, publicationId: null, commits: [] });
    const { result } = renderHook(() =>
      useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }),
    );

    await act(async () => {
      await result.current.press({ isRetry: true });
    });

    expect(result.current.phase).toEqual({
      kind: 'result',
      result: {
        tone: 'failed',
        sentence: 'Nothing was pushed: yarn knip --cache failed. The comments stay as they were.',
        failure: { output: error },
      },
    });
    expect(result.current.fixTarget?.mountId).toBe(MOUNT_LEDGER);
    expect(result.current.fixTarget?.pending).toContain('pull request #12 with 2 fix commits');
  });

  it('says the fix is pushed, not the old failure, when nothing else waits after an agent fix', async () => {
    useAppStore.setState({
      sessionResolvePublications: {
        [SESSION.id]: [
          {
            id: 'pub-ledger',
            sessionId: SESSION.id,
            repo: 'harborline/ledger-core',
            prNumber: 12,
            branch: 'hl/ledger-core',
            targetRef: 'main',
            localHead: 'a41c9e2aaaa',
            remoteHead: '7d02b11bbbb',
            commitShas: ['a41c9e2aaaa'],
            candidateIds: [],
            approvedItemIds: [],
            requiresPush: true,
            mountTarget: null,
            phase: 'failed',
            pushedHead: null,
            confirmedAt: 2,
            completedAt: 3,
            holder: null,
            heartbeatAt: null,
            error: '$ yarn knip\nerror: failed to push some refs',
            createdAt: 1,
          },
        ],
      },
    });
    retry.mockResolvedValueOnce({ ...PREVIEW, publicationId: null, commits: [] });
    const { result } = renderHook(() =>
      useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }),
    );

    let followUp: Awaited<ReturnType<typeof result.current.retryAfterFix>> = undefined;
    await act(async () => {
      followUp = await result.current.retryAfterFix();
    });

    expect(retry).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT_LEDGER });
    expect(result.current.phase).toEqual({
      kind: 'result',
      result: { tone: 'done', sentence: 'The fix is pushed. Nothing else is waiting.' },
    });
    expect(followUp).toEqual({
      tone: 'done',
      sentence: 'The fix is pushed. Nothing else is waiting.',
    });
  });

  it('still reports what the retry after a fix did when no screen shows it any more', async () => {
    retry.mockResolvedValueOnce({ ...PREVIEW, publicationId: null, commits: [] });
    const view = renderHook(() => useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }));
    const { retryAfterFix } = view.result.current;
    view.unmount();

    const followUp = await retryAfterFix();

    expect(followUp).toEqual({
      tone: 'done',
      sentence: 'The fix is pushed. Nothing else is waiting.',
    });
  });

  it('retries the push as a plain retry after the dependencies were reinstalled', async () => {
    retry.mockResolvedValueOnce({ ...PREVIEW, publicationId: null, commits: [] });
    const { result } = renderHook(() =>
      useReviewPush({ sessionId: SESSION.id, mountId: MOUNT_LEDGER }),
    );

    await act(async () => {
      result.current.retryAfterDeps();
    });

    expect(retry).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT_LEDGER });
    expect(result.current.phase).toEqual({
      kind: 'result',
      result: { tone: 'done', sentence: 'Nothing is waiting for the push.' },
    });
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
