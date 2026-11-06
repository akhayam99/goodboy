// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../../store/storyHarness';
import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';
import { aView } from '../../../../../auto/testing/autoViewFixtures';
import { registerSendNowPort, type SendNowPort } from '../../../../../auto/sendNowPort';
import { registerWithdrawPort, type WithdrawPort } from '../../../../../auto/withdrawPort';
import { registerTreeRetryPort, type TreeRetryPort } from '../../../../../auto/treeRetryPort';
import { useQueuedRows, type QueuedRows } from '.';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

const IMAGE = {
  id: 'image-1',
  kind: 'image' as const,
  fileName: 'timeline.png',
  mimeType: 'image/png',
  relPath: '.goodboy/attachments/image-1/timeline.png',
  dir: '/scratch/session-harborline',
};

const MESSAGE = {
  rowId: 'outbox-user-2',
  createdAt: Date.UTC(2026, 9, 20, 12, 10, 0),
  text: 'Also keep the retry window at 30 seconds.',
  images: [IMAGE],
};

const VIEW = aView({ phase: 'waiting', pendingMessages: [MESSAGE] });

type IdFn = (id: string) => void;

type Spies = {
  readonly editQueued: Mock<IdFn>;
  readonly removeQueued: Mock<IdFn>;
  readonly sendQueued: Mock<IdFn>;
  readonly retryQueued: Mock<IdFn>;
  readonly setValue: Mock<(next: string) => void>;
  readonly setAttachments: Mock<(next: ReadonlyArray<PendingAttachment>) => void>;
};

const mountRows = (): { readonly spies: Spies; readonly current: () => QueuedRows } => {
  const spies: Spies = {
    editQueued: vi.fn<IdFn>(),
    removeQueued: vi.fn<IdFn>(),
    sendQueued: vi.fn<IdFn>(),
    retryQueued: vi.fn<IdFn>(),
    setValue: vi.fn<(next: string) => void>(),
    setAttachments: vi.fn<(next: ReadonlyArray<PendingAttachment>) => void>(),
  };
  const { result } = renderHook(() =>
    useQueuedRows({
      sessionId: SESSION,
      queue: [],
      view: VIEW,
      isAgentStopped: false,
      wrapperRef: { current: null },
      ...spies,
    }),
  );
  return { spies, current: () => result.current };
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    attachment_read: IMAGE_DATA_URL,
  });
});

afterEach(() => {
  cleanup();
  registerWithdrawPort({ port: null });
  registerSendNowPort({ port: null });
  registerTreeRetryPort({ port: null });
});

describe('Edit on an Auto row', () => {
  it('names the tree and the row, then moves the words and the images to the composer', async () => {
    const withdraw = vi.fn<WithdrawPort>(async () => ({ kind: 'withdrawn' }));
    registerWithdrawPort({ port: withdraw });
    const { spies, current } = mountRows();

    await act(async () => current().onEdit(MESSAGE.rowId));

    expect(withdraw).toHaveBeenCalledWith({ treeId: VIEW.tree.id, rowId: MESSAGE.rowId });
    expect(spies.setValue).toHaveBeenCalledWith(MESSAGE.text);
    const [restored] = spies.setAttachments.mock.calls[0]?.[0] ?? [];
    expect(restored).toMatchObject({ id: 'image-1', fileName: 'timeline.png' });
    expect(spies.editQueued).not.toHaveBeenCalled();
  });

  it('still moves the words to the composer when the refresh after the withdraw fails', async () => {
    registerWithdrawPort({ port: vi.fn<WithdrawPort>(async () => ({ kind: 'withdrawn' })) });
    const store = await importStore();
    store.setState({
      loadAutoTrees: vi.fn(async () => {
        throw new Error('database is locked');
      }),
    });
    const { spies, current } = mountRows();

    await act(async () => current().onEdit(MESSAGE.rowId));

    expect(spies.setValue).toHaveBeenCalledWith(MESSAGE.text);
  });

  it('leaves the composer alone when Auto already claimed the row', async () => {
    registerWithdrawPort({ port: vi.fn<WithdrawPort>(async () => ({ kind: 'delivered' })) });
    const { spies, current } = mountRows();

    await act(async () => current().onEdit(MESSAGE.rowId));

    expect(spies.setValue).not.toHaveBeenCalled();
    expect(spies.setAttachments).not.toHaveBeenCalled();
    expect(current().failure).toBeNull();
  });

  it('keeps the row and shows the error when the withdraw is refused', async () => {
    registerWithdrawPort({
      port: vi.fn<WithdrawPort>(async () => ({
        kind: 'refused',
        message: 'Another window runs this conversation. Edit it there.',
      })),
    });
    const { spies, current } = mountRows();

    await act(async () => current().onEdit(MESSAGE.rowId));

    expect(spies.setValue).not.toHaveBeenCalled();
    expect(current().failure?.message).toContain('Another window');
  });

  it('keeps the row when the window has no Auto door yet', async () => {
    const { spies, current } = mountRows();

    await act(async () => current().onEdit(MESSAGE.rowId));

    expect(spies.setValue).not.toHaveBeenCalled();
    expect(current().failure?.title).toBe("Couldn't take the message back");
  });

  it('does not withdraw when an image cannot be read, so the words are not lost', async () => {
    const withdraw = vi.fn<WithdrawPort>(async () => ({ kind: 'withdrawn' }));
    registerWithdrawPort({ port: withdraw });
    stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, attachment_read: '' });
    const { spies, current } = mountRows();

    await act(async () => current().onEdit(MESSAGE.rowId));

    await waitFor(() => expect(current().failure).not.toBeNull());
    expect(withdraw).not.toHaveBeenCalled();
    expect(spies.setValue).not.toHaveBeenCalled();
  });

  it('sends a tray row to the tray edit', async () => {
    const { spies, current } = mountRows();

    await act(async () => current().onEdit('tray-turn-1'));

    expect(spies.editQueued).toHaveBeenCalledWith('tray-turn-1');
  });
});

describe('Remove, Send now and Retry on an Auto row', () => {
  it('Remove withdraws the row and leaves the composer alone', async () => {
    const withdraw = vi.fn<WithdrawPort>(async () => ({ kind: 'withdrawn' }));
    registerWithdrawPort({ port: withdraw });
    const { spies, current } = mountRows();

    await act(async () => current().onRemove(MESSAGE.rowId));

    expect(withdraw).toHaveBeenCalledWith({ treeId: VIEW.tree.id, rowId: MESSAGE.rowId });
    expect(spies.setValue).not.toHaveBeenCalled();
    expect(spies.removeQueued).not.toHaveBeenCalled();
  });

  it('Remove on a row already claimed changes nothing and shows no error', async () => {
    registerWithdrawPort({ port: vi.fn<WithdrawPort>(async () => ({ kind: 'delivered' })) });
    const { current } = mountRows();

    await act(async () => current().onRemove(MESSAGE.rowId));

    expect(current().failure).toBeNull();
  });

  it('Remove on a tray row removes it from the tray', async () => {
    const { spies, current } = mountRows();

    await act(async () => current().onRemove('tray-turn-1'));

    expect(spies.removeQueued).toHaveBeenCalledWith('tray-turn-1');
  });

  it('Send now sends only that Auto row and keeps the children running', async () => {
    const sendNow = vi.fn<SendNowPort>(async () => ({ kind: 'retried' }));
    registerSendNowPort({ port: sendNow });
    const { spies, current } = mountRows();

    await act(async () => current().onSendNow(MESSAGE.rowId));

    expect(sendNow).toHaveBeenCalledWith({ treeId: VIEW.tree.id, rowId: MESSAGE.rowId });
    expect(spies.sendQueued).not.toHaveBeenCalled();
  });

  it('shows the refusal when Send now loses the claim to another window', async () => {
    registerSendNowPort({
      port: vi.fn<SendNowPort>(async () => ({
        kind: 'refused',
        message: 'Another window runs this conversation. Send it there.',
      })),
    });
    const { current } = mountRows();

    await act(async () => current().onSendNow(MESSAGE.rowId));

    expect(current().failure?.message).toContain('Another window');
  });

  it('Send now on a tray row sends it through the tray', async () => {
    const { spies, current } = mountRows();

    await act(async () => current().onSendNow('tray-turn-1'));

    expect(spies.sendQueued).toHaveBeenCalledWith('tray-turn-1');
  });

  it('Retry resumes the tree and shows the refusal when it cannot', async () => {
    const retry = vi.fn<TreeRetryPort>(async () => ({
      kind: 'refused',
      message: 'This conversation reached its time limit.',
    }));
    registerTreeRetryPort({ port: retry });
    const { current } = mountRows();

    await act(async () => current().onRetry(MESSAGE.rowId));

    expect(retry).toHaveBeenCalledWith({ treeId: VIEW.tree.id });
    expect(current().failure?.message).toContain('time limit');
  });
});
