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
import { U25_B_GONE_BRANCH_SCENES } from './b-gone-branch';

const WAIT = { timeout: 6000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

type RenderSceneParams = {
  readonly name: keyof typeof U25_B_GONE_BRANCH_SCENES;
};

const renderScene = ({ name }: RenderSceneParams) => {
  const Scene = U25_B_GONE_BRANCH_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const goneRowOf = async () => {
  await screen.findAllByTestId('project-mount-row', {}, WAIT);
  await waitFor(() => expect(screen.getByText('Branch deleted')).toBeDefined(), WAIT);
  const row = screen
    .getAllByTestId('project-mount-row')
    .find((candidate) => within(candidate).queryByText('Branch deleted') !== null);
  if (row === undefined) {
    throw new Error('no row says Branch deleted');
  }
  return row;
};

describe('the gone branch scenes', () => {
  it('registers the two scenes', () => {
    expect(Object.keys(U25_B_GONE_BRANCH_SCENES)).toEqual(['gone-branch', 'gone-branch-restore']);
  });

  it('gone-branch says Branch deleted and offers Remove, never Reopen or Restore', async () => {
    renderScene({ name: 'gone-branch' });

    const row = await goneRowOf();

    within(row).getByRole('button', { name: /^Remove for/ });
    expect(within(row).queryByRole('button', { name: /^Reopen for/ })).toBeNull();
    expect(within(row).queryByRole('button', { name: /^Restore branch for/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('gone-branch-restore offers Restore branch beside Remove', async () => {
    renderScene({ name: 'gone-branch-restore' });

    const row = await goneRowOf();

    within(row).getByRole('button', { name: /^Restore branch for/ });
    within(row).getByRole('button', { name: /^Remove for/ });
  });
});
