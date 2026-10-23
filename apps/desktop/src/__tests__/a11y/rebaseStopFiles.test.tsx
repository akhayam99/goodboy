// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { runA11yCheck } from './utils';

const WAIT = { timeout: 3_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const mount = (): void => {
  const Scene = MOCK_SCENES['u26-rebase-conflict-light'];
  if (Scene === undefined) {
    throw new Error('u26-rebase-conflict-light is not a registered scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('a11y, the files of a stopped rebase', () => {
  it('names the state of every file next to its path', async () => {
    mount();
    const list = await screen.findByRole('list', { name: 'Files that conflict' }, WAIT);
    const rows = within(list).getAllByRole('listitem');

    expect(rows.map((row) => row.textContent)).toEqual([
      'Still conflictssrc/ledger/postCredit.tsOpen',
      'Still conflictssrc/webhooks/dedupe.tsOpen',
    ]);
    expect(
      within(rows[0] ?? list).getByRole('button', { name: 'Open src/ledger/postCredit.ts' })
        .textContent,
    ).toBe('Open');
    const violations = (await runA11yCheck(list)).violations.map((violation) => violation.id);
    expect(violations).toEqual([]);
  });
});
