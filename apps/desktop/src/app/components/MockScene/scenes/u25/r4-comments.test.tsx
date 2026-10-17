// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../../registry';
import { U25_R4_COMMENTS_SCENES } from './r4-comments';

type SceneName = keyof typeof U25_R4_COMMENTS_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type RenderParams = {
  readonly name: SceneName;
  readonly waitMs?: number;
};

const renderScene = async ({ name, waitMs = 40 }: RenderParams): Promise<void> => {
  const Scene = U25_R4_COMMENTS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  });
};

const drawer = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-slot="review-comment-drawer"] section');

const section = (): HTMLElement =>
  drawer() ??
  (() => {
    throw new Error('no comment drawer');
  })();

const verbsOf = (): ReadonlyArray<string | null> =>
  within(screen.getByRole('toolbar', { name: 'Comment actions' }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('data-review-verb'));

describe('the r4 comments scenes', () => {
  it('registers the four scenes', () => {
    expect(Object.keys(U25_R4_COMMENTS_SCENES)).toEqual([
      'r4-comments-list',
      'r4-comments-drawer',
      'r4-comments-drawer-ready',
      'r4-comments-drawer-failed',
    ]);
    for (const name of Object.keys(U25_R4_COMMENTS_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('shows one list with no drawer, no detail bar and Fix comments in the header', async () => {
    await renderScene({ name: 'r4-comments-list' });

    screen.getByRole('navigation', { name: 'Comments' });
    expect(drawer()).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Comment actions' })).toBeNull();
    const fix = screen.getByRole('button', { name: /^Fix \d+ comments?$/ });
    expect(fix.closest('[data-slot="branch-tab-actions"]')).not.toBeNull();
    expect(screen.queryByRole('article', { name: 'Comment' })).toBeNull();
  });

  it('opens an open comment in the drawer with Skip, Reply and Fix last', async () => {
    await renderScene({ name: 'r4-comments-drawer' });

    expect(within(section()).getByRole('article', { name: 'Comment' })).toBeDefined();
    expect(verbsOf()).toEqual(['reviewComment.skip', 'reviewComment.reply', 'reviewComment.draft']);
    expect(section().querySelector('[data-drawer-meta]')?.textContent ?? '').toMatch(/ago/);
  });

  it('opens a fix to review with Apply fix as its primary', async () => {
    await renderScene({ name: 'r4-comments-drawer-ready' });

    expect(verbsOf().at(-1)).toBe('reviewComment.accept');
  });

  it('shows the failed Skip inline under the actions with Retry on the verb', async () => {
    await renderScene({ name: 'r4-comments-drawer-failed', waitMs: 500 });

    const alert = within(section()).getByRole('alert');
    expect(alert.textContent).toContain('The review queue is busy in another window.');
    expect(
      within(screen.getByRole('toolbar', { name: 'Comment actions' })).getByRole('button', {
        name: /^Retry/,
      }),
    ).toBeDefined();
  });
});
