import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SessionEvent, SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    restoreHistory: vi.fn(async (_params: unknown): Promise<void> => undefined),
    reportError: vi.fn(async (_params: unknown) => undefined),
    navigate: vi.fn(),
    openRewriteHistory: vi.fn(),
    loadHistoryDraft: vi.fn(async (_params: unknown) => undefined),
  },
}));

vi.mock('../../../store', () => ({
  agentPlace: vi.fn(),
  useAppStore: { getState: () => store },
}));

import { useHistoryRowActions } from './index';

const SESSION_ID = 'session-cascadia' as SessionId;

const REWRITTEN = {
  id: 'event-1',
  sessionId: SESSION_ID,
  kind: 'history_rewritten',
  payload: { mountId: 'mount-ledger', backupRef: 'refs/goodboy/backup/1', worktreePath: '/w' },
} as unknown as SessionEvent;

beforeEach(() => {
  store.restoreHistory.mockReset();
  store.reportError.mockClear();
});

describe('useHistoryRowActions', () => {
  it('logs a failed undo with the verb it names', async () => {
    store.restoreHistory.mockRejectedValueOnce(new Error('the backup ref is gone'));
    const { result } = renderHook(() => useHistoryRowActions({ sessionId: SESSION_ID }));

    result.current({ event: REWRITTEN, events: [REWRITTEN] })?.action?.onAct();

    await vi.waitFor(() =>
      expect(store.reportError).toHaveBeenCalledWith({
        title: "Couldn't undo the rewrite",
        error: new Error('the backup ref is gone'),
        sessionId: SESSION_ID,
      }),
    );
    expect(store.reportError).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the undo lands', async () => {
    const { result } = renderHook(() => useHistoryRowActions({ sessionId: SESSION_ID }));

    result.current({ event: REWRITTEN, events: [REWRITTEN] })?.action?.onAct();

    await vi.waitFor(() => expect(store.restoreHistory).toHaveBeenCalledTimes(1));
    expect(store.reportError).not.toHaveBeenCalled();
  });
});
