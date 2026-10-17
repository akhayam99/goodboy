// @vitest-environment happy-dom
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('puts Comment on the header and the other file actions in its one menu', () => {
    const Scene = U25_B_DIFF_FILE_ACTIONS_SCENES['file-actions-header'];
    render(
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>,
    );

    const header = within(
      document.querySelector<HTMLElement>('[data-slot="diff-file-header"]') ?? document.body,
    );
    header.getByRole('button', { name: 'Comment' });
    fireEvent.click(header.getByRole('button', { name: /^More for / }));
    for (const name of ['Open in editor', 'Copy path', 'Show whole file']) {
      screen.getByRole('menuitem', { name });
    }
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
