// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { useIdentifierUses } from './index';

const RESULT = {
  matches: [{ path: 'ledger-core.ts', line: 1, column: 14, text: 'export const creditKey = 1;' }],
  truncated: false,
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('identifier requests', () => {
  it('drops a late success after the worktree changes', async () => {
    let answer: (value: typeof RESULT) => void = () => undefined;
    stubStoryInvoke({
      worktree_grep_word: () =>
        new Promise<typeof RESULT>((resolve) => {
          answer = resolve;
        }),
    });
    const { result, rerender } = renderHook((params) => useIdentifierUses(params), {
      initialProps: { worktreePath: '/mock/ledger-core', word: 'creditKey' },
    });
    stubStoryInvoke({ worktree_grep_word: { matches: [], truncated: false } });
    rerender({ worktreePath: '/mock/payments-api', word: 'creditKey' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      answer(RESULT);
    });
    expect(result.current).toEqual({ status: 'ready', matches: [], isTruncated: false });
  });

  it('drops a late failure after another symbol succeeds', async () => {
    let reject: (error: Error) => void = () => undefined;
    stubStoryInvoke({
      worktree_grep_word: () =>
        new Promise<typeof RESULT>((_resolve, rejectRequest) => {
          reject = rejectRequest;
        }),
    });
    const { result, rerender } = renderHook((params) => useIdentifierUses(params), {
      initialProps: { worktreePath: '/mock/ledger-core', word: 'settle' },
    });
    stubStoryInvoke({ worktree_grep_word: RESULT });
    rerender({ worktreePath: '/mock/ledger-core', word: 'creditKey' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      reject(new Error('Earlier search failed'));
    });
    expect(result.current).toEqual({
      status: 'ready',
      matches: RESULT.matches,
      isTruncated: false,
    });
  });
});
