// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../../../store/storyHarness';
import { ConnectionHistory } from './index';

let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(cleanup);

it('shows the empty history sentence', () => {
  render(<ConnectionHistory providerId="cursor" label="Cursor" />);
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByText('No changes since Goodboy started.')).toBeDefined();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('shows only twenty events with the newest first and closes on Escape', () => {
  const health = store.getState().providerHealth;
  store.setState({
    providerHealth: {
      ...health,
      cursor: {
        ...health.cursor,
        events: Array.from({ length: 25 }, (_, index) => ({
          at: Date.now() - (25 - index) * 60_000,
          from: 'unknown',
          to: 'connected',
          reason: `Harborline event ${index}`,
        })),
      },
    },
  });
  render(<ConnectionHistory providerId="cursor" label="Cursor" />);
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  const rows = within(screen.getByRole('list')).getAllByRole('listitem');
  expect(rows).toHaveLength(20);
  expect(rows[0]?.textContent).toContain('Harborline event 24');
  expect(rows[19]?.textContent).toContain('Harborline event 5');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('list')).toBeNull();
});
