import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U25_B_LIVE_EDIT_SCENES } from './b-live-edit';

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

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

type Params = { readonly name: keyof typeof U25_B_LIVE_EDIT_SCENES; readonly isDark: boolean };
const show = ({ name, isDark }: Params) => {
  document.documentElement.classList.toggle('dark', isDark);
  const Scene = U25_B_LIVE_EDIT_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe.each([false, true])('live edit scenes in dark theme %s', (isDark) => {
  it('shows the local edit with Undo and Force push, then restores and redoes it', async () => {
    show({ name: 'live-edit-after', isDark });
    await screen.findByRole('listitem', { name: 'Guard the Acme export' });
    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    await screen.findByRole('menuitem', { name: /Force push 7 commits/ });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Undo commit edit' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo commit edit' }));
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Guard the Acme export' })).toBeNull(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Redo commit edit' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Redo commit edit' }));
    await screen.findByRole('listitem', { name: 'Guard the Acme export' });
  });
  it('mounts the busy row', async () => {
    show({ name: 'live-edit-busy', isDark });
    await screen.findByText('Editing commit');
    const undo = screen.queryByRole('button', { name: 'Undo commit edit' });
    expect(undo === null || undo.hasAttribute('disabled')).toBe(true);
  });
  it('dismisses the conflicting edit through Undo', async () => {
    show({ name: 'live-edit-conflict', isDark });
    await screen.findByRole('button', { name: 'Rewrite with an agent' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('continues after stash consent through the real action', async () => {
    show({ name: 'live-edit-stash', isDark });
    fireEvent.click(await screen.findByRole('button', { name: 'Stash and continue' }));
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: 'Fix typo in CSV header' })).toBeNull(),
    );
  });
});
