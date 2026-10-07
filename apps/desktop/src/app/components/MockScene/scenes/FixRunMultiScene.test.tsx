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
import { FixRunMultiDoneScene } from './FixRunMultiDoneScene';
import { FixRunMultiScene } from './FixRunMultiScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('the multi comment fix run drawer scenes', () => {
  it('shows a working run over four comments with no commits block', async () => {
    render(
      <ToastProvider>
        <FixRunMultiScene />
      </ToastProvider>,
    );

    const lead = await screen.findByTestId('fix-run-lead');

    expect(within(lead).getByTestId('fix-run-status')).toBeDefined();
    expect(within(lead).getByRole('heading', { name: 'Covers 4 comments' })).toBeDefined();
    expect(within(lead).queryByRole('heading', { name: 'What it did' })).toBeNull();
    expect(within(lead).queryByRole('heading', { name: 'Commits' })).toBeNull();
  });

  it('shows the finished run with its summary and commits', async () => {
    render(
      <ToastProvider>
        <FixRunMultiDoneScene />
      </ToastProvider>,
    );

    const lead = await screen.findByTestId('fix-run-lead');

    expect(within(lead).queryByTestId('fix-run-status')).toBeNull();
    expect(within(lead).getByRole('heading', { name: 'What it did' })).toBeDefined();
    expect(await within(lead).findByText('c81e5aa')).toBeDefined();
  });
});
