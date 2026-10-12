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
  it('opens with the definition, change and elsewhere groups', async () => {
    const Scene = U24_DIFF_PEEK_SCENES['diff-peek-open'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByText('1 definition · 4 uses · 2 in this change');
    within(dialog).getByRole('group', { name: 'Defined in' });
    within(dialog).getByRole('group', { name: 'In this change' });
    within(dialog).getByRole('group', { name: 'Elsewhere' });
  });
  it('says the symbol is not defined in the project', async () => {
    const Scene = U24_DIFF_PEEK_SCENES['diff-peek-empty'];
    render(<Scene />);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByText('Not defined in this project');
    expect(within(dialog).queryByRole('button')).toBeNull();
  });
});
