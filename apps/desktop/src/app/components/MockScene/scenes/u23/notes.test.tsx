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

describe('the u23 notes scenes', () => {
  it('registers the two scenes the notes keep after the drawer went', () => {
    expect(Object.keys(U23_NOTES_SCENES)).toEqual(['branch-files-notes', 'branch-comments-no-pr']);
    for (const name of Object.keys(U23_NOTES_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('opens Files with the three notes under their lines and no drawer beside it', async () => {
    renderScene({ name: 'branch-files-notes' });

    const notes = await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('region', { name: 'Your notes' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Notes \d/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Fix \d+ comments?$/ })).toBeNull();
  });

  it('lists the notes on Comments before a pull request, with no empty state in their place', async () => {
    renderScene({ name: 'branch-comments-no-pr' });

    const list = await screen.findByRole('navigation', { name: 'Comments' }, WAIT);
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.queryByText('No pull request yet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create pull request' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^On GitHub/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^Notes/ })).toBeNull();
  });
});
