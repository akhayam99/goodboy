// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_DIFF_PEEK_SCENES } from './diff-peek';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('diff peek scenes', () => {
  it('registers both states', () => {
    for (const [id, scene] of Object.entries(U24_DIFF_PEEK_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });
  it('opens with both groups', async () => {
    const Scene = U24_DIFF_PEEK_SCENES['diff-peek-open'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    expect(await within(dialog).findByText(/Defined in 1 place/)).toBeDefined();
    expect(within(dialog).getByText(/Used in 4 places/)).toBeDefined();
    expect(within(dialog).getAllByText('In this change').length).toBeGreaterThan(0);
  });
  it('says nothing was found', async () => {
    const Scene = U24_DIFF_PEEK_SCENES['diff-peek-empty'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    expect(await within(dialog).findByText('Nothing found in this worktree.')).toBeDefined();
  });
});
