// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const tabSelected = (name: string): boolean =>
  screen.getByRole('tab', { name: new RegExp(`^${name}`) }).getAttribute('aria-selected') ===
  'true';

describe('the multi comment fix run drawer scenes', () => {
  it('opens a working run on its transcript with the reply field', async () => {
    render(
      <ToastProvider>
        <FixRunMultiScene />
      </ToastProvider>,
    );

    expect(await screen.findByText(/Reading the retry loop in payments-api/)).toBeDefined();
    expect(tabSelected('Transcript')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Message to Fix run' })).toBeDefined();
    expect(screen.queryByTestId('fix-run-lead')).toBeNull();
  });

  it('shows a working run over four comments with no commits block on the Fix tab', async () => {
    render(
      <ToastProvider>
        <FixRunMultiScene />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Fix' }));
    const lead = await screen.findByTestId('fix-run-lead');

    expect(within(lead).getByTestId('fix-run-status')).toBeDefined();
    expect(within(lead).getByRole('heading', { name: 'Covers 4 comments' })).toBeDefined();
    expect(within(lead).queryByRole('heading', { name: 'What it did' })).toBeNull();
    expect(within(lead).queryByRole('heading', { name: 'Commits' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Message to Fix run' })).toBeNull();
  });

  it('opens the finished run on its summary and commits, with no reply field', async () => {
    render(
      <ToastProvider>
        <FixRunMultiDoneScene />
      </ToastProvider>,
    );

    const lead = await screen.findByTestId('fix-run-lead');

    expect(tabSelected('Fix')).toBe(true);
    expect(within(lead).queryByTestId('fix-run-status')).toBeNull();
    expect(within(lead).getByRole('heading', { name: 'What it did' })).toBeDefined();
    expect(await within(lead).findByText('c81e5aa')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Message to Fix run' })).toBeNull();
  });

  it('keeps the finished run transcript one tab away', async () => {
    render(
      <ToastProvider>
        <FixRunMultiDoneScene />
      </ToastProvider>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Transcript' }));

    expect(await screen.findByText(/Reading the retry loop in payments-api/)).toBeDefined();
    expect(screen.queryByTestId('fix-run-lead')).toBeNull();
  });
});
