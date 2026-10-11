// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const noteFixes = vi.hoisted((): { current: unknown[] } => ({ current: [] }));
vi.mock('../useNoteFixes', () => ({ useNoteFixes: () => noteFixes.current }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { DiffComment } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { NoteFix } from '../../lib/noteFixes';
import { useDiffNotes } from './index';

const SESSION = aSession();
const SESSION_ID = SESSION.id;
const STAMP = SESSION.createdAt;

const NOTE: DiffComment = {
  id: 'n1',
  sessionId: SESSION_ID,
  filePath: 'src/ledger.ts',
  body: 'Guard the residual when a weight is zero',
  status: 'open',
  createdAt: STAMP,
  authorKind: 'user',
};

const FIX: NoteFix = {
  note: NOTE,
  threadId: 't1',
  state: null,
  group: 'open',
  word: 'Open',
  tone: 'neutral',
  run: null,
  isClosed: false,
  canReopen: false,
  isLocked: false,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  noteFixes.current = [FIX];
});
afterEach(cleanup);

describe('useDiffNotes delete', () => {
  it('marks a note restorable so the thread deletes without a question', () => {
    const { result } = renderHook(() => useDiffNotes({ sessionId: SESSION_ID }), {
      wrapper: ToastProvider,
    });

    expect(result.current.comments.threads.map((thread) => thread.canRestore)).toEqual([true]);
  });

  it('deletes at once, records Undo, and Undo posts the same note again', async () => {
    const { result } = renderHook(() => useDiffNotes({ sessionId: SESSION_ID }), {
      wrapper: ToastProvider,
    });

    await act(async () => {
      result.current.comments.onDelete?.('n1');
      await Promise.resolve();
    });

    expect(storySpies.deleteDiffComment).toHaveBeenCalledWith(expect.anything(), 'n1');
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(storySpies.insertDiffComment).not.toHaveBeenCalled();

    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });

    expect(storySpies.insertDiffComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      SESSION_ID,
      'src/ledger.ts',
      'Guard the residual when a weight is zero',
      undefined,
      undefined,
      undefined,
    );
  });
});
