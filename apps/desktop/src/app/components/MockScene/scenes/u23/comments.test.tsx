// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U23_COMMENTS_SCENES } from './comments';

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

const renderScene = async ({ name }: { readonly name: keyof typeof U23_COMMENTS_SCENES }) => {
  const Scene = U23_COMMENTS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const bar = (): HTMLElement => screen.getByRole('toolbar', { name: 'Comment actions' });

const regionTitles = (): ReadonlyArray<string | null> =>
  within(list())
    .getAllByRole('region')
    .map((region) => region.getAttribute('aria-label'));

describe('the u23 comments scenes', () => {
  it('registers the six scenes under the names the plan uses', () => {
    expect(Object.keys(U23_COMMENTS_SCENES)).toEqual([
      'comments-groups',
      'comments-ready-to-push',
      'comments-push-failed',
      'comments-left-open',
      'comments-action-bar',
      'comments-working',
    ]);
    for (const name of Object.keys(U23_COMMENTS_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('puts ten comments in every group, in the delivery order', async () => {
    await renderScene({ name: 'comments-groups' });

    expect(regionTitles()).toEqual([
      'Needs you',
      'Working',
      'Ready to push',
      'Open',
      'Done',
      'Left open on GitHub',
    ]);
    const counts = Object.fromEntries(
      within(list())
        .getAllByRole('region')
        .map((region) => {
          const label = region.getAttribute('aria-label') ?? '';
          const match = new RegExp(`${label} (\\d+)`).exec(region.textContent ?? '');
          return [label, Number(match?.[1] ?? 0)];
        }),
    );
    expect(counts).toEqual({
      'Needs you': 5,
      Working: 1,
      'Ready to push': 1,
      Open: 1,
      Done: 1,
      'Left open on GitHub': 1,
    });
  });

  it("orders Needs you as Question, Push failed, To review, and never calls a failed push Couldn't fix", async () => {
    await renderScene({ name: 'comments-groups' });

    const needsYou = within(list()).getByRole('region', { name: 'Needs you' });
    const words = Array.from(needsYou.querySelectorAll('[data-row-state]')).map(
      (node) => node.textContent,
    );
    expect(words).toEqual(['Question', 'Push failed', 'To review', 'To review', 'To review']);
    expect(within(list()).queryByText("Couldn't fix")).toBeNull();
    expect(within(needsYou).getByRole('button', { name: /^Accept \d/ })).toBeDefined();
  });

  it('shows Ready to push with a quiet Push link that reads what the header reads', async () => {
    await renderScene({ name: 'comments-ready-to-push' });

    const ready = within(list()).getByRole('region', { name: 'Ready to push' });
    expect(within(ready).getByText('Ready to push 3')).toBeDefined();
    const pushes = screen.getAllByRole('button', { name: /^Push 3/ });
    expect(pushes).toHaveLength(2);
    expect(within(ready).getByRole('button', { name: 'Push 3' })).toBeDefined();
    expect(within(ready).getAllByText('Ready')).toHaveLength(3);
  });

  it('draws a failed push as Push failed in Needs you, with a red mark on the session', async () => {
    await renderScene({ name: 'comments-push-failed' });

    const needsYou = within(list()).getByRole('region', { name: 'Needs you' });
    expect(within(needsYou).getAllByText('Push failed').length).toBe(2);
    expect(screen.queryByText("Couldn't fix")).toBeNull();
    expect(screen.getAllByText(/2 comments didn't go out/).length).toBeGreaterThan(0);
    expect(within(bar()).getByRole('button', { name: 'Retry push' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toContain('Push failed');
  });

  it('keeps a comment left open on its host, quiet, with the way back', async () => {
    await renderScene({ name: 'comments-left-open' });

    const left = within(list()).getByRole('region', { name: 'Left open on GitHub' });
    expect(within(left).getByRole('button', { name: /^Left open on GitHub 1/ })).toBeDefined();
    expect(within(left).getByText('Left open')).toBeDefined();
    expect(
      screen.getByText('Left open on GitHub. You skipped it. The thread stays open there.'),
    ).toBeDefined();
    expect(within(bar()).getByRole('button', { name: /^Undo skip/ })).toBeDefined();
  });

  it('puts Accept in the bar after the thread, outside the scrolling column', async () => {
    await renderScene({ name: 'comments-action-bar' });

    const article = screen.getByRole('article', { name: 'Comment' });
    const accept = within(bar()).getByRole('button', { name: /^Accept/ });
    expect(article.contains(accept)).toBe(false);
    expect(article.compareDocumentPosition(bar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar().closest('[data-radix-scroll-area-viewport]')).toBeNull();
    expect(within(bar()).getByRole('button', { name: /^Reply only/ })).toBeDefined();
    expect(within(bar()).getByRole('button', { name: /^Skip/ })).toBeDefined();
    expect(within(bar()).queryByText('R', { selector: 'kbd[data-look="cap"]' })).toBeNull();
  });

  it('stops a working comment only behind a confirm', async () => {
    await renderScene({ name: 'comments-working' });

    expect(within(bar()).getByRole('button', { name: 'Open transcript' })).toBeDefined();
    fireEvent.click(within(bar()).getByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('dialog', { name: 'Stop this fix run?' })).toBeDefined();
  });
});
