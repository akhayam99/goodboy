// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U23_NOTES_SCENES } from './notes';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const WAIT = { timeout: 3_000 };

const renderScene = ({ name }: { readonly name: keyof typeof U23_NOTES_SCENES }) => {
  const Scene = U23_NOTES_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const drawer = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Your notes' }, WAIT);

describe('the u23 notes scenes', () => {
  it('registers the five scenes under the names the plan uses', () => {
    expect(Object.keys(U23_NOTES_SCENES)).toEqual([
      'branch-files-notes',
      'branch-notes-fixing',
      'branch-notes-ready',
      'branch-notes-empty',
      'branch-comments-no-pr',
    ]);
    for (const name of Object.keys(U23_NOTES_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('opens Files with the drawer on three notes of two files and the count in the toolbar', async () => {
    renderScene({ name: 'branch-files-notes' });

    const panel = await drawer();
    expect(within(panel).getByText('3 open')).toBeDefined();
    expect(within(panel).getAllByRole('region').length).toBeGreaterThanOrEqual(2);
    expect(within(panel).getAllByText('Open note').length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getByRole('button', { name: 'Fix 2' })).toBeDefined();
    expect(within(panel).getAllByRole('button', { name: 'Close' }).length).toBeGreaterThan(1);
    expect(within(panel).getAllByRole('button', { name: 'Delete' }).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Notes 3' })).toBeDefined();
  });

  it('shows a fix running on two notes with the lane line and Stop', async () => {
    renderScene({ name: 'branch-notes-fixing' });

    const panel = await drawer();
    expect(within(panel).getByTestId('resolve-run-status').textContent).toContain('Fixing 1 of 2');
    expect(within(panel).getByRole('button', { name: 'Stop' })).toBeDefined();
    expect(within(panel).getByText('Queued, after the current fix')).toBeDefined();
  });

  it('shows a ready note with Accept and Skip beside one that could not be fixed with Retry', async () => {
    renderScene({ name: 'branch-notes-ready' });

    const panel = await drawer();
    expect(within(panel).getByRole('button', { name: 'Accept' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Skip' })).toBeDefined();
    expect(within(panel).getByRole('button', { name: 'Close the note' })).toBeDefined();
    expect(within(panel).getAllByRole('button', { name: /^Retry/ }).length).toBeGreaterThan(0);
  });

  it('keeps the empty drawer to one line and no Notes button', async () => {
    renderScene({ name: 'branch-notes-empty' });

    const panel = await drawer();
    expect(
      within(panel).getByText('No open notes. Add one with Add note on a line or a file.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Notes \d/ })).toBeNull();
  });

  it('reads No pull request yet on Comments and lists no note there', async () => {
    renderScene({ name: 'branch-comments-no-pr' });

    expect(await screen.findByText('No pull request yet', undefined, WAIT)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
    expect(screen.queryByText(/Cap the backoff/)).toBeNull();
  });
});
