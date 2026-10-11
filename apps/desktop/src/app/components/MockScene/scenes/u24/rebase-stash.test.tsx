vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { U24_REBASE_STASH_SCENES } from './rebase-stash';

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

type Params = { readonly name: keyof typeof U24_REBASE_STASH_SCENES; readonly isDark?: boolean };
const show = ({ name, isDark = false }: Params) => {
  document.documentElement.classList.toggle('dark', isDark);
  const Scene = U24_REBASE_STASH_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe.each([false, true])('rebase stash scenes with dark theme %s', (isDark) => {
  it('asks once, then stashes and rebases on the captured plan', async () => {
    show({ name: 'rebase-choosing', isDark });
    const trigger = await screen.findByRole('button', { name: 'Stash and rebase' });
    screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(trigger);
    await screen.findByText('Rebased on main');
    expect(screen.queryByRole('button', { name: 'Stash and rebase' })).toBeNull();
  });
  it('cancels without moving the branch', async () => {
    show({ name: 'rebase-choosing', isDark });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull());
  });
  it('shows the carried count and offers undo', async () => {
    show({ name: 'rebase-done-carried', isDark });
    await screen.findByText('7 commits. Your 11 files were not touched. Backup kept for 30 days.');
    screen.getByRole('button', { name: 'Undo rewrite' });
  });
  it('keeps conflicts saved and offers the exact stash command', async () => {
    show({ name: 'rebase-restore-conflict', isDark });
    await screen.findByText('Rebased on main, but 2 of your files conflict');
    screen.getByRole('button', { name: 'Copy the stash command' });
    screen.getByRole('button', { name: 'Open terminal' });
  });
  it('brings saved files back after an interrupted move', async () => {
    show({ name: 'rebase-bring-back', isDark });
    fireEvent.click(await screen.findByRole('button', { name: 'Bring them back' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull());
    expect(screen.queryByText('Rebased on main')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bring them back' })).toBeNull();
  });
});
