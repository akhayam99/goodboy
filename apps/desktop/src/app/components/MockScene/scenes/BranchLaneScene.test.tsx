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
  it('keeps one quiet count of the fix in the bar, with one stop button', async () => {
    const { container } = renderLane('working');

    await screen.findAllByRole('button', { name: /^Stop fixing / });
    const counts = container.querySelectorAll<HTMLElement>('[data-fix-run-count]');

    expect(counts).toHaveLength(1);
    expect(counts[0]?.textContent).toContain('1 of 3');
    expect(
      within(counts[0] ?? container).getByRole('button', { name: /^Stop fixing / }),
    ).toBeDefined();
  });

  it('offers the whole chain at once on the last ready fix', async () => {
    renderLane('chain');

    const accept = await screen.findAllByRole('button', { name: 'Apply 3 fixes' });

    expect(accept.length).toBeGreaterThan(0);
  });
});
