// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { U24_COMMITS_SCENES } from './commits';

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
});

const SETTLE_MS = 600;

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

const renderScene = ({ name }: { readonly name: keyof typeof U24_COMMITS_SCENES }) => {
  const Scene = U24_COMMITS_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u24 commits scenes', () => {
  it('draws one column at rest with the hint line and no plan chrome', async () => {
    renderScene({ name: 'commits-rest' });

    await screen.findByRole('list', { name: 'Commits' }, { timeout: 4_000 });
    await settle();

    expect(screen.getByText('Based on main')).toBeDefined();
    expect(screen.queryByText(/is here now/)).toBeNull();
    expect(
      screen.getByText('Drag a commit to move it, drop it on another to fold it in.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keys' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Backups' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Legend' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Planned changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(document.querySelector('[data-after-node]')).toBeNull();
  });

  it('ignores legacy staged edits and keeps the live branch visible', async () => {
    renderScene({ name: 'commits-planned' });

    await screen.findByRole('list', { name: 'Commits' }, { timeout: 4_000 });
    await settle();

    expect(screen.queryByRole('heading', { name: 'Planned changes' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull();
    screen.getByRole('button', { name: 'Undo commit edit' });
  });

  it('keeps the single column on a 1920 stage', async () => {
    renderScene({ name: 'commits-rest-1920' });

    await screen.findByRole('list', { name: 'Commits' }, { timeout: 4_000 });
    await settle();

    expect(document.querySelectorAll('[data-history-lane]')).toHaveLength(1);
    expect(document.querySelector('[data-after-node]')).toBeNull();
  });
});
