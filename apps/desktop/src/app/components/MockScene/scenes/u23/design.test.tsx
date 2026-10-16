// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { DesignCommentsScene } from './DesignCommentsScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(cleanup);

describe('design-comments', () => {
  it('shows the overview vocabulary, counts and selected thread actions', () => {
    render(
      <ToastProvider>
        <DesignCommentsScene />
      </ToastProvider>,
    );
    const list = screen.getByRole('navigation', { name: 'Comments' });
    expect(within(list).getByRole('heading', { name: 'Needs you 4' })).toBeDefined();
    expect(within(list).getByRole('heading', { name: 'Working 2' })).toBeDefined();
    expect(within(list).getByRole('heading', { name: 'Ready to push 2' })).toBeDefined();
    screen.getByRole('toolbar', { name: 'Comment actions' });
    expect(within(list).getAllByText('Fix ready', { selector: '[data-row-state]' })).toHaveLength(
      2,
    );
  });
});
