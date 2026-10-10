// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_UPDATER_CARD_SCENES } from './updater-card';

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

describe('the updater card scenes', () => {
  it('registers the three scenes for the capture', () => {
    expect(Object.keys(U24_UPDATER_CARD_SCENES)).toEqual([
      'update-card',
      'update-card-narrow',
      'update-card-long-version',
    ]);
    for (const id of Object.keys(U24_UPDATER_CARD_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(U24_UPDATER_CARD_SCENES[id]);
    }
  });

  it.each([
    ['update-card', '0.24.1 is ready'],
    ['update-card-narrow', '0.24.1 is ready'],
    [
      'update-card-long-version',
      '0.24.1-beta.20261010.preview.build.8f3c2a91e7d54b6fa0c1d2e3f4a5b6c7d8e9f0 is ready',
    ],
  ])('%s shows the card beside the chip with its three actions', async (id, name) => {
    const Scene = U24_UPDATER_CARD_SCENES[id];
    if (Scene === undefined) {
      throw new Error(`missing scene ${id}`);
    }
    render(<Scene />);

    const dialog = await screen.findByRole('dialog', { name });
    expect(screen.getByRole('complementary', { name: 'Sidebar' }).contains(dialog)).toBe(false);
    for (const label of ['Later', "What's new", 'Restart now']) {
      expect(within(dialog).getByRole('button', { name: label }).textContent).toBe(label);
    }
  });
});
