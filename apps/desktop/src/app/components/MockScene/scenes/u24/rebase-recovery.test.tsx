// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { U24_REBASE_RECOVERY_SCENES } from './rebase-recovery';
import { RewriterTranscriptScene } from './RewriterTranscriptScene';

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
  window.history.replaceState(null, '', '/');
});

const renderScene = ({
  name,
  query = '',
}: {
  readonly name: keyof typeof U24_REBASE_RECOVERY_SCENES;
  readonly query?: string;
}) => {
  window.history.replaceState(null, '', `/?${query}`);
  const Scene = U24_REBASE_RECOVERY_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const SETTLE_MS = 600;

const waitForSettledReads = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

describe('the u24 rebase recovery scenes', () => {
  it('opens the note row on a stuck rebase', async () => {
    renderScene({ name: 'rebase-stuck-note' });

    const note = await screen.findByRole(
      'textbox',
      { name: 'Note for History rewriter' },
      { timeout: 4_000 },
    );
    await waitForSettledReads();

    expect(note.getAttribute('placeholder')).toBe('What should it do differently?');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('offers to bring the online commits in when the origin moved', async () => {
    renderScene({ name: 'rebase-origin-moved' });

    await screen.findByRole('button', { name: 'Bring them into the plan' }, { timeout: 4_000 });
    await waitForSettledReads();

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });

  it('offers a retry, the terminal and the hook output when the push failed', async () => {
    renderScene({ name: 'rebase-push-failed' });

    await screen.findByRole('button', { name: 'Fix with agent' }, { timeout: 4_000 });
    await waitForSettledReads();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByRole('button', { name: 'Open terminal here' })).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Push output' }).textContent).toContain(
      'seenEvents is assigned a value but never used',
    );
  });

  it('has no composer on the transcript of a finished rewrite', async () => {
    renderScene({ name: 'rewriter-transcript-finished' });

    await screen.findByText(
      'This rewrite is finished. Retry it from the banner on the Branch page.',
      undefined,
      { timeout: 4_000 },
    );
    await waitForSettledReads();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open rebase' })).toBeDefined();
  });

  it('keeps the composer on a stuck rewrite whose copy is alive', async () => {
    render(
      <ToastProvider>
        <RewriterTranscriptScene isLive />
      </ToastProvider>,
    );

    const input = await screen.findByRole('textbox', undefined, { timeout: 4_000 });
    await waitForSettledReads();

    expect(input.getAttribute('placeholder')).toBe('Tell History rewriter what to do next');
    expect(screen.queryByText(/This rewrite is finished/)).toBeNull();
  });
});
