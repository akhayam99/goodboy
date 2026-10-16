// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { U25_P_0251_SCENES } from './p-0251';

const WAIT = { timeout: 6000 };

const BULK_STATS: Readonly<
  Record<'rounding' | 'postings', { additions: number; deletions: number }>
> = {
  rounding: { additions: 12842, deletions: 10406 },
  postings: { additions: 99999, deletions: 101 },
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
  Reflect.set(window, '__TAURI_INTERNALS__', {
    invoke: (command: string, args?: { worktreePath?: string }) => {
      if (command !== 'worktree_changed_files') {
        return new Promise<never>(() => undefined);
      }
      const path = args?.worktreePath ?? '';
      const stat = path.includes('rounding')
        ? BULK_STATS.rounding
        : path.includes('postings')
          ? BULK_STATS.postings
          : { additions: 0, deletions: 0 };
      return { paths: [], entries: [], numstat: '', ...stat };
    },
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

describe('the p-0251 scenes', () => {
  it('registers the scenes', () => {
    expect(Object.keys(U25_P_0251_SCENES)).toEqual(['ask-reset', 'context-mark-read']);
  });

  it('context-mark-read shows the decisions once read, with no changes group left', async () => {
    clearSceneInvoke();
    const Scene = U25_P_0251_SCENES['context-mark-read'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await screen.findByRole('region', { name: 'Decisions' }, WAIT);
    expect(screen.queryByRole('region', { name: 'Changed since you last looked' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull();
  });

  it('ask-reset shows a two turn chat with Reset chat in the header', async () => {
    clearSceneInvoke();
    const Scene = U25_P_0251_SCENES['ask-reset'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const panel = await screen.findByRole('region', { name: 'Ask' }, WAIT);
    within(panel).getByRole('button', { name: 'Reset chat' });
    await waitFor(() => expect(screen.getAllByTestId('ask-turn')).toHaveLength(2), WAIT);
  });
});
