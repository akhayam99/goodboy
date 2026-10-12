// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U25_DIFF_PEEK_SCENES } from './diff-peek';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('project symbol peek scenes', () => {
  it('registers the library and collapsed references states', () => {
    for (const [id, scene] of Object.entries(U25_DIFF_PEEK_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('expands references without leaving the diff', async () => {
    const Scene = U25_DIFF_PEEK_SCENES['diff-peek-more'];
    render(<Scene />);
    const more = await screen.findByRole('button', { name: 'Show 6 more' });
    const name = 'apps/payments-api/src/ledger-core/components/notify-relay.tsx:37';
    expect(screen.queryByRole('button', { name })).toBeNull();
    await userEvent.click(more);
    screen.getByRole('button', { name });
    expect(screen.queryByRole('button', { name: 'Show 6 more' })).toBeNull();
  });

  it('keeps library props quiet even when a dependency has a declaration', async () => {
    const Scene = U25_DIFF_PEEK_SCENES['diff-peek-library'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of maxWidth' });
    await within(dialog).findByText('Not defined in this project');
    expect(within(dialog).queryByRole('button')).toBeNull();
  });
});
