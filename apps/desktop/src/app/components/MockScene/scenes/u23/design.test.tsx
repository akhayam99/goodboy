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
    expect(within(list).getByRole('region', { name: 'Needs you' }).textContent).toContain(
      'Needs you 4',
    );
    expect(within(list).getByRole('region', { name: 'Working' }).textContent).toContain(
      'Working 2',
    );
    expect(within(list).getByRole('region', { name: 'Ready to push' }).textContent).toContain(
      'Ready to push 2',
    );
    screen.getByRole('toolbar', { name: 'Comment actions' });
    expect(within(list).getAllByText('To review', { selector: '[data-row-state]' })).toHaveLength(
      2,
    );
  });
});
