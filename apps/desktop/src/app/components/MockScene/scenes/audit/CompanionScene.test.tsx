// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { CompanionScene } from './CompanionScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

describe('the companion scene', () => {
  it('keeps its key and lands on Settings, iPhone with the paired list', async () => {
    expect(MOCK_SCENES.companion).toBe(CompanionScene);

    render(<CompanionScene />);

    await screen.findByRole('navigation', { name: 'Settings scopes' }, WAIT);
    expect(await screen.findByText('1 paired iPhone', undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('iPhone');
    expect(screen.queryByRole('button', { name: 'Close pairing' })).toBeNull();
  });
});
