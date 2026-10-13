// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U25_B_BRANCH_TOOLS_SCENES } from './b-branch-tools';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the branch tools scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_B_BRANCH_TOOLS_SCENES)).toEqual(['branch-split-mounted']);
    expect(MOCK_SCENES['branch-split-mounted']).toBe(
      U25_B_BRANCH_TOOLS_SCENES['branch-split-mounted'],
    );
  });

  it('branch-split-mounted shows both branches of the split mounted', async () => {
    const Scene = U25_B_BRANCH_TOOLS_SCENES['branch-split-mounted'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() => expect(screen.getAllByTestId('project-mount-row')).toHaveLength(2));

    const rows = screen.getAllByTestId('project-mount-row');
    const text = rows.map((row) => row.textContent ?? '');
    expect(text.some((row) => row.includes('fix/ledger-reconciliation-rounding-drift'))).toBe(true);
    expect(text.some((row) => row.includes('fix/ledger-reconciliation-idempotent-postings'))).toBe(
      true,
    );
  });
});
