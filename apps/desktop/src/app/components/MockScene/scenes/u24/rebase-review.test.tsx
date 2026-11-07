vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { RebaseReviewScene } from './RebaseReviewScene';
import { U24_REBASE_REVIEW_SCENES } from './rebase-review';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
});
afterEach(() => {
  cleanup();
  clearSceneInvoke();
  document.documentElement.classList.remove('dark');
});

describe('the rebase review scene', () => {
  it.each(['light', 'dark'])('mounts the review in %s', async (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const Scene = U24_REBASE_REVIEW_SCENES['rebase-review-change'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await screen.findByRole('region', { name: 'Review the change' });
    screen.getByText('webhook.ts');
    screen.getByText('ledger.ts');
    screen.getByRole('button', { name: 'Accept and apply' });
  });

  it('applies the reviewed change and offers the backup undo', async () => {
    render(
      <ToastProvider>
        <RebaseReviewScene />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Accept and apply' }));
    await screen.findByRole('button', { name: 'Undo rewrite' });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Review the change' })).toBeNull(),
    );
  });

  it('discards the copy and returns to the stopped banner', async () => {
    render(
      <ToastProvider>
        <RebaseReviewScene />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Review the change' })).toBeNull(),
    );
    screen.getByText('The result did not match your branch');
    expect(screen.queryByRole('button', { name: 'Review the change' })).toBeNull();
  });
  it('puts Open in editor and Copy path in the menu of each file header', async () => {
    render(
      <ObjectMenuProvider>
        <ToastProvider>
          <RebaseReviewScene />
        </ToastProvider>
      </ObjectMenuProvider>,
    );
    const collapse = await screen.findByRole('button', { name: 'Collapse webhook.ts' });
    const header = collapse.closest<HTMLElement>('[data-slot="diff-file-header"]');
    if (header === null) {
      throw new Error('no file header');
    }
    fireEvent.click(within(header).getByRole('button', { name: 'More for webhook.ts' }));
    screen.getByRole('menuitem', { name: 'Open in editor' });
    screen.getByRole('menuitem', { name: 'Copy path' });
  });
});
