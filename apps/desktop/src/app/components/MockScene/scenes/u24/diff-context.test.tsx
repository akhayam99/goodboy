// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U24_DIFF_CONTEXT_SCENES } from './diff-context';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('diff context scenes', () => {
  it('registers all three states', () => {
    for (const [id, scene] of Object.entries(U24_DIFF_CONTEXT_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });
  it('reveals adjacent context in the real diff grid', async () => {
    const Scene = U24_DIFF_CONTEXT_SCENES['diff-gaps'];
    render(<Scene />);
    fireEvent.click(screen.getByRole('button', { name: 'Show 9 lines' }));
    expect(await screen.findByText('export const ledger1 = 1;')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show 20 preceding lines' }));
    expect(await screen.findByText('export const ledger40 = 40;')).toBeDefined();
    expect(screen.queryByText('export const ledger39 = 39;')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 19 lines' }));
    expect(await screen.findByText('export const ledger21 = 21;')).toBeDefined();
  });
  it('expands the whole file without residual gaps', async () => {
    const Scene = U24_DIFF_CONTEXT_SCENES['diff-gaps-expanded'];
    render(<Scene />);
    expect(await screen.findByText('export const ledger100 = 100;')).toBeDefined();
    const grid = screen.getByRole('grid', { name: 'Changes in src/ledger-core.ts' });
    expect(within(grid).queryByRole('button', { name: /^Show / })).toBeNull();
  });
  it('offers an editor for a file beyond the limits', async () => {
    const Scene = U24_DIFF_CONTEXT_SCENES['diff-gaps-toolarge'];
    render(<Scene />);
    expect(
      (await screen.findAllByText('This file is too large to expand here.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Open in editor' }).length).toBeGreaterThan(0);
  });
});
