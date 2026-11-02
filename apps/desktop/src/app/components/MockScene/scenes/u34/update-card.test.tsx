// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U34_UPDATE_CARD_SCENES } from './update-card';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
  clearMocks();
});

it('registers the scene with the mock scene registry', () => {
  expect(MOCK_SCENES['u34-u27-update-card']).toBe(U34_UPDATE_CARD_SCENES['u34-u27-update-card']);
});

it('u34-u27-update-card draws two buttons and What’s new as a link inside the sentence', async () => {
  const Scene = U34_UPDATE_CARD_SCENES['u34-u27-update-card'];
  render(<Scene />);

  const dialog = await screen.findByRole('dialog', { name: 'Goodboy 0.31.0 is available' });
  const link = within(dialog).getByRole('button', { name: "What's new" });
  expect(link.closest('p')?.textContent).toContain(
    'It downloads in about a minute. Nothing restarts until you say so.',
  );
  const verbRow = within(dialog).getByRole('button', { name: 'Later' }).parentElement;
  expect(verbRow?.querySelectorAll('button')).toHaveLength(2);
  within(dialog).getByRole('button', { name: 'Update now' });
});
