// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { ATTN_NOISE_SCENES } from './attn-noise';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('attn-noise', () => {
  it('shows an error toast with Retry, a warning toast and a transient success toast', async () => {
    const Scene = ATTN_NOISE_SCENES['attn-noise'];
    render(<Scene />);

    await screen.findByText('Push to payments-api failed', undefined, WAIT);
    screen.getByRole('button', { name: 'Retry' });
    screen.getByText('Session reached 80% of its limit');
    screen.getByText('Pull request opened');
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(3);
  });
});
