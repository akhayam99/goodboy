// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aSession } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import type { GrepMatch } from '../../../worktree/worktree';
import { IdentifierPeekDrawer } from './index';

const WORKTREE = '/mock/payments-api';
const PATCH = [
  'diff --git a/src/ledger-core.ts b/src/ledger-core.ts',
  '--- a/src/ledger-core.ts',
  '+++ b/src/ledger-core.ts',
  '@@ -30 +30,2 @@',
  ' const ledger30 = 0;',
  '+export const creditKey = 1;',
  '',
].join('\n');
const TEXT = Array.from({ length: 40 }, (_, index) => `const ledger${index + 1} = 0;`).join('\n');
const NEW_TEXT = TEXT.split('\n')
  .flatMap((line, index) => (index === 30 ? ['export const creditKey = 1;', line] : [line]))
  .join('\n');
const SIDES = { old: TEXT, new: NEW_TEXT, too_large: false };

const DEFINITION: GrepMatch = {
  path: 'src/ledger-core.ts',
  line: 31,
  column: 14,
  text: 'export const creditKey = 1;',
};
const CHANGED_USE: GrepMatch = {
  path: 'src/ledger-core.ts',
  line: 35,
  column: 5,
  text: 'use(creditKey);',
};
const UNCHANGED_USE: GrepMatch = {
  path: 'apps/notify-relay/src/send.ts',
  line: 7,
  column: 5,
  text: 'send(creditKey);',
};

const SESSION = aSession();

type Stub = { readonly matches?: ReadonlyArray<GrepMatch> };

const stub = ({ matches = [UNCHANGED_USE, CHANGED_USE, DEFINITION] }: Stub = {}) =>
  stubStoryInvoke({
    worktree_grep_word: { matches, truncated: false },
    worktree_diff: PATCH,
    worktree_file_sides: SIDES,
    explore_read: { type: 'text', text: 'export const send = () => creditKey;', truncated: false },
  });

type MountParams = { readonly selected?: GrepMatch };

const mount = ({ selected = DEFINITION }: MountParams = {}) =>
  render(
    <IdentifierPeekDrawer
      sessionId={SESSION.id}
      worktreePath={WORKTREE}
      word="creditKey"
      selected={{ path: selected.path, line: selected.line }}
      renderSource={({ path }) => <p>No changes on this branch: {path}</p>}
      onClose={() => undefined}
    />,
  );

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  Element.prototype.scrollIntoView = vi.fn();
  stub();
});
afterEach(() => {
  cleanup();
});

describe('identifier peek drawer', () => {
  it('lists a changed definition file once, tagged Changed, with one selected row', async () => {
    mount();
    await screen.findByRole('group', { name: 'Unchanged files' });
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual([
      'Defined in',
      'Unchanged files',
    ]);
    const rows = screen
      .getAllByRole('button')
      .filter((button) => /^[\w/.-]+:\d+$/.test(button.getAttribute('aria-label') ?? ''));
    const paths = rows.map((row) => (row.getAttribute('aria-label') ?? '').replace(/:\d+$/, ''));
    expect(new Set(paths).size).toBe(paths.length);
    expect(rows.filter((row) => row.getAttribute('aria-current') === 'true')).toHaveLength(1);
    const definition = screen.getByRole('group', { name: 'Defined in' });
    within(definition).getByText('Changed');
    within(definition).getByText('2 uses');
  });

  it('keeps the file name out of the truncating part of the path', async () => {
    mount();
    const row = await screen.findByRole('button', { name: 'apps/notify-relay/src/send.ts:7' });
    const name = row.querySelector('[data-peek-name]');
    expect(name?.textContent).toBe('send.ts');
    expect(name?.hasAttribute('data-truncates')).toBe(false);
    expect(row.querySelector('[data-peek-directory]')?.hasAttribute('data-truncates')).toBe(true);
  });

  it('shows the diff of a file changed on this branch and scrolls to the match', async () => {
    mount({ selected: CHANGED_USE });
    await screen.findByRole('grid', { name: 'Changes in src/ledger-core.ts' });
    await waitFor(() =>
      expect(document.querySelector('[data-peek-flash] [data-line="new:35"]')).not.toBeNull(),
    );
    expect(screen.queryByText(/No changes on this branch/)).toBeNull();
  });

  it('shows the plain source with a note for an unchanged file', async () => {
    mount({ selected: UNCHANGED_USE });
    await screen.findByText(/No changes on this branch/);
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('swaps the view when another result is chosen and keeps the drawer open', async () => {
    mount({ selected: UNCHANGED_USE });
    await screen.findByText(/No changes on this branch/);
    await userEvent.click(screen.getByRole('button', { name: 'src/ledger-core.ts:31' }));
    await screen.findByRole('grid', { name: 'Changes in src/ledger-core.ts' });
    expect(screen.queryByText(/No changes on this branch/)).toBeNull();
    const current = screen.getByRole('button', { name: 'src/ledger-core.ts:31' });
    expect(current.getAttribute('aria-current')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'apps/notify-relay/src/send.ts:7' }));
    await screen.findByText(/No changes on this branch/);
  });

  it('shows the file directory dimmed next to the file name', async () => {
    mount();
    const row = await screen.findByRole('button', { name: 'apps/notify-relay/src/send.ts:7' });
    within(row).getByText('apps/notify-relay/src/');
    within(row).getByText('send.ts');
  });

  it('retries a failed search without closing', async () => {
    stubStoryInvoke({
      worktree_grep_word: () => Promise.reject(new Error('the search took too long')),
      worktree_diff: PATCH,
      worktree_file_sides: SIDES,
    });
    mount();
    await screen.findByText(/the search took too long/);
    stub();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('group', { name: 'Unchanged files' });
    expect(screen.queryByText(/the search took too long/)).toBeNull();
  });

  it('retries a failed diff load', async () => {
    stubStoryInvoke({
      worktree_grep_word: { matches: [DEFINITION], truncated: false },
      worktree_diff: () => Promise.reject(new Error('diff unavailable')),
    });
    mount();
    await screen.findByText(/diff unavailable/);
    stub();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('grid', { name: 'Changes in src/ledger-core.ts' });
  });

  it('says when there are no uses', async () => {
    stub({ matches: [] });
    mount();
    await screen.findByText('No uses found');
  });
});
