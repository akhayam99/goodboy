// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { BranchLaneScene } from './BranchLaneScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderLane = (variant: 'working' | 'chain') =>
  render(
    <ToastProvider>
      <BranchLaneScene variant={variant} />
    </ToastProvider>,
  );

describe('the branch lane scenes', () => {
  it('shows one lane header for the branch with the position and the next comment', async () => {
    renderLane('working');

    const status = await screen.findByTestId('resolve-run-status');

    expect(within(status).getByText(/^Fixing 1 of 3 · next: /)).toBeDefined();
    expect(within(status).getByRole('button', { name: 'Stop' })).toBeDefined();
  });

  it('offers the whole chain at once on the last ready fix', async () => {
    renderLane('chain');

    const accept = await screen.findByRole('button', { name: 'Accept 3 fixes' });

    expect(accept).toBeDefined();
  });
});
