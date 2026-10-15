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
import { U23_HEADERS_SCENES } from './headers';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the header branch push scene', () => {
  it('opens the one Push panel and keeps the header Push as its toggle', async () => {
    const Scene = U23_HEADERS_SCENES['header-branch-push-confirm'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const panel = screen.getByRole('group', { name: /^Push 2 commits to/ });
    expect(within(panel).getAllByRole('button', { name: 'Push' })).toHaveLength(1);
    within(panel).getByText('Not a fix');
    const header = screen.getByRole('button', { name: /^Push \d+ (fix|fixes)$/, expanded: true });
    expect(panel.contains(header)).toBe(false);
  });
});
