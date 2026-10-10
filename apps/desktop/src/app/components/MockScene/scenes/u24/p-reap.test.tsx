// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U24_P_REAP_SCENES } from './p-reap';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const WAIT = { timeout: 4000 };

describe('the u24 reap scene', () => {
  it('registers the processes stopped scene', () => {
    expect(Object.keys(U24_P_REAP_SCENES)).toEqual(['processes-stopped']);
  });

  it('shows one plain line under the turn that names what was stopped', async () => {
    const Scene = U24_P_REAP_SCENES['processes-stopped'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const line = await screen.findByTestId('transcript-stopped-processes', undefined, WAIT);

    expect(line.textContent).toBe(
      'Stopped 2 processes this turn left running: next-server, 1 more.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
