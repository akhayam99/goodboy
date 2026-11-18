// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { U24_REBASE_RECOVERY_SCENES } from './rebase-recovery';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  sessionStorage.clear();
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  resetWorktreeStatusCache();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

type SceneParams = {
  readonly name: keyof typeof U24_REBASE_RECOVERY_SCENES;
};

const renderScene = ({ name }: SceneParams) => {
  const Scene = U24_REBASE_RECOVERY_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the history card on the branch page', () => {
  it('sits in the header flow above a long title, never pinned over it', async () => {
    renderScene({ name: 'rebase-origin-moved-long-title' });

    const card = await screen.findByRole('region', { name: 'Rebase' }, { timeout: 4_000 });
    const title = screen.getByRole('heading', { level: 1 });

    expect(title.textContent).toContain('settle the ledger-core postings in one batch');
    expect(card.closest('[data-slot="pane-lead"]')).toBeNull();
    expect(card.closest('[data-slot="reveal-overlay"]')).toBeNull();
    expect(card.closest('[data-page-header]')?.contains(title)).toBe(true);
    expect(card.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws the done card on the same card surface, and Dismiss leaves no card', async () => {
    renderScene({ name: 'rebase-done-card' });

    const card = await screen.findByRole('region', { name: 'Rebase' }, { timeout: 4_000 });

    expect(card.textContent).toContain('Backup kept for 30 days.');
    expect(card.querySelector('[data-placement="banner"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Rebase' })).toBeNull());
    expect(screen.queryByText(/Rebased here/)).toBeNull();
  });

  it('settles a stopped card on its own when origin already has the rebased commits', async () => {
    renderScene({ name: 'rebase-origin-settled' });

    await screen.findByText('Origin now has your rebased commits', undefined, { timeout: 4_000 });

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Rebase' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Rebase on their commits' })).toBeNull();
  });
});
