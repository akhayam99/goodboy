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
import { U24_P_PREFLIGHT_SCENES } from './p-preflight';

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

const renderScene = (name: keyof typeof U24_P_PREFLIGHT_SCENES) => {
  const Scene = U24_P_PREFLIGHT_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const SETTLE_MS = 600;

const waitForSettledReads = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

describe('the u24 preflight scenes', () => {
  it('shows the Next row with the count of files not committed and no Rebase button', async () => {
    renderScene('rebasedirty');

    expect(
      await screen.findByText('11 files not committed', undefined, { timeout: 3_000 }),
    ).toBeDefined();

    await waitForSettledReads();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Rebase' })).toBeNull();
  });

  it('locks the creation mode while Scribe writes the text', async () => {
    renderScene('branch-pr-scribe-writing');

    const manual = await screen.findByRole('tab', { name: 'Manual' }, { timeout: 3_000 });

    await waitForSettledReads();
    expect(manual.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Draft with an agent' }).getAttribute('title')).toBe(
      'Scribe is still writing the text.',
    );
    expect(screen.getByText('Scribe is writing the title and description.')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Create pull request' }).hasAttribute('disabled'),
    ).toBe(true);
  });
});
