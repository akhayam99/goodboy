// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { MOCK_SCENES } from '../..';
import { U25_B_DIFF_FILE_ACTIONS_SCENES } from './b-diff-file-actions';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  installFakeResizeObserver();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the diff file actions scenes', () => {
  it('registers every scene', () => {
    for (const [id, scene] of Object.entries(U25_B_DIFF_FILE_ACTIONS_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('puts the four file actions on the header as icons with no overflow', () => {
    const Scene = U25_B_DIFF_FILE_ACTIONS_SCENES['file-actions-header'];
    render(<Scene />);

    const header = document.querySelector<HTMLElement>('[data-slot="diff-file-header"]');
    for (const name of ['Comment', 'Open in editor', 'Copy path', 'Show whole file']) {
      within(header ?? document.body).getByRole('button', { name });
    }
    expect(screen.queryByRole('button', { name: /^More actions for/ })).toBeNull();
  });

  it('opens the drawer unified while the page is unified', async () => {
    const Scene = U25_B_DIFF_FILE_ACTIONS_SCENES['file-whole-drawer-unified'];
    render(<Scene />);

    expect(
      (await screen.findByRole('tab', { name: 'Unified' })).getAttribute('aria-selected'),
    ).toBe('true');
    await waitFor(() => expect(document.body.textContent).toContain('retryLimit'));
  });

  it('switches the drawer to split and leaves the page setting alone', async () => {
    const Scene = U25_B_DIFF_FILE_ACTIONS_SCENES['file-whole-drawer-split'];
    render(<Scene />);

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Split' }).getAttribute('aria-selected')).toBe('true'),
    );
    expect(localStorage.getItem('goodboy:diff-layout-mode')).toBeNull();
  });

  it('focuses the filter field with its search glyph and shortcut hint inside it', () => {
    const Scene = U25_B_DIFF_FILE_ACTIONS_SCENES['filter-files-focused'];
    render(<Scene />);

    const input = screen.getByRole('searchbox', { name: 'Filter files' });
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeDefined();
  });
});
