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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FileDiff } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { worktreeFileSides, type GrepMatch } from '../../../worktree/worktree';
import type { FileSidesLoader } from '../../hooks/useFileSides';
import { DiffView } from '../DiffView';

const FILE: FileDiff = {
  path: 'ledger-core.ts',
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [
    {
      header: '',
      oldStart: 30,
      newStart: 30,
      oldLines: 2,
      newLines: 3,
      lines: [
        { kind: 'context', oldLine: 30, newLine: 30, text: 'const ledger30 = 0;' },
        { kind: 'add', oldLine: null, newLine: 31, text: 'export const creditKey = 1;' },
        { kind: 'context', oldLine: 31, newLine: 32, text: 'const ledger32 = 0;' },
      ],
    },
  ],
};

const DEFINITION: GrepMatch = {
  path: 'ledger-core.ts',
  line: 31,
  column: 14,
  text: 'export const creditKey = 1;',
};
const OTHER_FILE: GrepMatch = {
  path: 'notify-relay/send.ts',
  line: 7,
  column: 5,
  text: 'use(creditKey);',
};
const HIDDEN: GrepMatch = {
  path: 'ledger-core.ts',
  line: 90,
  column: 7,
  text: 'bill(creditKey);',
};

const TEXT = Array.from({ length: 100 }, (_, index) => `const ledger${index + 1} = 0;`).join('\n');
const NEW_TEXT = TEXT.split('\n')
  .flatMap((line, index) => (index === 30 ? ['export const creditKey = 1;', line] : [line]))
  .join('\n');
const SIDES = { old: TEXT, new: NEW_TEXT, too_large: false };
const load: FileSidesLoader = (file) =>
  worktreeFileSides({ worktreePath: '/mock/payments-api', path: file.path });

type GrepParams = { readonly matches: ReadonlyArray<GrepMatch>; readonly isTruncated?: boolean };

const grep = ({ matches, isTruncated = false }: GrepParams) => ({
  worktree_grep_word: { matches, truncated: isTruncated },
  worktree_file_sides: SIDES,
});

type Selected = { readonly node: Text; readonly host: Element };

type SelectParams = { readonly word: string };

const selectWord = ({ word }: SelectParams): Selected => {
  const grid = screen.getByRole('grid', { name: 'Changes in ledger-core.ts' });
  const walker = document.createTreeWalker(grid, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const at = node.textContent?.indexOf(word) ?? -1;
    if (at >= 0 && node instanceof Text && node.parentElement !== null) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return { node, host: node.parentElement };
    }
  }
  throw new Error(`no text node holds ${word}`);
};

type RenderParams = { readonly onOpenElsewhere?: (match: GrepMatch) => void };

const renderDiff = ({ onOpenElsewhere = () => undefined }: RenderParams = {}) =>
  render(
    <DiffView
      files={[FILE]}
      presentation="inline"
      loadFileSides={load}
      identifierPeek={{ worktreePath: '/mock/payments-api', onOpenElsewhere }}
    />,
  );

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke(grep({ matches: [OTHER_FILE, DEFINITION, HIDDEN] }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('identifier peek', () => {
  it('opens with the symbol kind and counts owned by the grouped results', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByText('1 definition · 2 uses · 2 in this change');
    within(dialog).getByText('const');
    const defined = within(dialog).getByRole('group', { name: 'Defined in' });
    within(defined).getByRole('button', { name: 'ledger-core.ts:31' });
    within(defined).getByText('Changed line');
  });

  it('puts changed-file references before elsewhere regardless of grep order', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByRole('group', { name: 'Elsewhere' });
    const groups = within(dialog).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Defined in',
      'In this change',
      'Elsewhere',
    ]);
    within(within(dialog).getByRole('group', { name: 'In this change' })).getByRole('button', {
      name: 'ledger-core.ts:90',
    });
    within(within(dialog).getByRole('group', { name: 'Elsewhere' })).getByRole('button', {
      name: 'notify-relay/send.ts:7',
    });
  });

  it.each([
    [OTHER_FILE],
    [{ ...DEFINITION, path: 'node_modules/acme/ledger-core.ts' }, OTHER_FILE],
    [{ ...DEFINITION, path: 'vendor/ledger-core.ts' }, OTHER_FILE],
  ])('hides uses when there is no project definition: %j', async (...matches) => {
    stubStoryInvoke(grep({ matches }));
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByText('Not defined in this project');
    expect(within(dialog).queryByRole('button')).toBeNull();
    expect(within(dialog).queryByRole('group')).toBeNull();
  });

  it('keeps the directory separator visible and highlights a word when its column was clipped', async () => {
    const path = 'apps/payments-api/src/ledger-core/components/notify-relay.tsx';
    stubStoryInvoke(grep({ matches: [DEFINITION, { ...OTHER_FILE, path, column: 90 }] }));
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const row = await screen.findByRole('button', { name: `${path}:7` });
    within(row).getByText('/');
    within(row).getByText('apps/payments-…ore/components');
    within(row).getByText('notify-relay.tsx');
    expect(within(row).getByText('creditKey').tagName).toBe('MARK');
  });

  it('lays every row of every group out as one path cell then one snippet cell', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await within(dialog).findByRole('group', { name: 'Elsewhere' });
    const rows = within(dialog).getAllByRole('button', { name: /:\d+$/ });

    expect(rows.length).toBeGreaterThan(2);
    for (const row of rows) {
      expect(row.children[0]?.hasAttribute('data-peek-path')).toBe(true);
      expect(row.children[1]?.hasAttribute('data-peek-snippet')).toBe(true);
    }
  });

  it('does not include dependency matches in project counts or reference rows', async () => {
    stubStoryInvoke(
      grep({
        matches: [DEFINITION, OTHER_FILE, { ...OTHER_FILE, path: 'vendor/notify-relay.ts' }],
      }),
    );
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByText('1 definition · 1 use · 1 in this change');
    expect(screen.queryByRole('button', { name: 'vendor/notify-relay.ts:7' })).toBeNull();
  });

  it('puts references on changed lines before unchanged references in the change', async () => {
    const changed = { ...DEFINITION, column: 5, text: 'use(creditKey);' };
    stubStoryInvoke(
      grep({
        matches: [OTHER_FILE, HIDDEN, changed, { ...DEFINITION, path: 'src/ledger-core.ts' }],
      }),
    );
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const group = await screen.findByRole('group', { name: 'In this change' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(['ledger-core.ts:31', 'ledger-core.ts:90']);
    within(within(group).getByRole('button', { name: 'ledger-core.ts:31' })).getByText(
      'Changed line',
    );
    within(within(group).getByRole('button', { name: 'ledger-core.ts:90' })).getByText(
      'In this change',
    );
  });

  it('reveals hidden references in place and reaches them with arrow keys and Enter', async () => {
    const matches = Array.from({ length: 8 }, (_, index) => ({ ...OTHER_FILE, line: index + 1 }));
    stubStoryInvoke(grep({ matches: [DEFINITION, ...matches] }));
    const open = vi.fn();
    renderDiff({ onOpenElsewhere: open });
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const more = await screen.findByRole('button', { name: 'Show 3 more' });
    expect(screen.queryByRole('button', { name: 'notify-relay/send.ts:6' })).toBeNull();
    await userEvent.click(more);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'notify-relay/send.ts:6' }),
    );
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(open).toHaveBeenCalledWith(matches[6]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens on an alt click through the caret under the pointer', async () => {
    renderDiff();
    const { host, node } = selectWord({ word: 'creditKey' });
    const at = (node.textContent ?? '').indexOf('creditKey') + 2;
    window.getSelection()?.removeAllRanges();
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at);
    Object.assign(document, { caretRangeFromPoint: () => range });
    fireEvent.click(host, { altKey: true });
    await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    Object.assign(document, { caretRangeFromPoint: undefined });
  });

  it('ignores a double click on something that is not an identifier', () => {
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: '= 1' }).host);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a truncation note', async () => {
    stubStoryInvoke(grep({ matches: [DEFINITION], isTruncated: true }));
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByText('Showing the first 300.');
  });

  it('says so when the search fails', async () => {
    stubStoryInvoke({
      worktree_grep_word: () => Promise.reject(new Error('the search took too long')),
    });
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByRole('alert');
    screen.getByText(/the search took too long/);
  });

  it('retries a failed search by reopening the same symbol', async () => {
    stubStoryInvoke({ worktree_grep_word: () => Promise.reject(new Error('Search unavailable')) });
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByRole('alert');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    stubStoryInvoke(grep({ matches: [DEFINITION] }));
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByRole('button', { name: 'ledger-core.ts:31' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Enter on a result in a visible changed line scrolls the diff and flashes it', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const open = vi.fn();
    renderDiff({ onOpenElsewhere: open });
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    const row = await screen.findByRole('button', { name: 'ledger-core.ts:31' });
    row.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        document.querySelector('[data-peek-flash]')?.querySelector('[data-line="new:31"]'),
      ).not.toBeNull(),
    );
    expect(scroll).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('expands the gap for a result hidden in it, then scrolls there', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const open = vi.fn();
    renderDiff({ onOpenElsewhere: open });
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await userEvent.click(await screen.findByRole('button', { name: 'ledger-core.ts:90' }));
    await waitFor(() =>
      expect(document.querySelector('[data-peek-flash] [data-line="new:90"]')).not.toBeNull(),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the Explore drawer for a result in a file outside this diff', async () => {
    const open = vi.fn();
    renderDiff({ onOpenElsewhere: open });
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await userEvent.click(await screen.findByRole('button', { name: 'notify-relay/send.ts:7' }));
    expect(open).toHaveBeenCalledWith(OTHER_FILE);
  });

  it('moves between results with the arrow keys', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByRole('button', { name: 'ledger-core.ts:31' });
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('ledger-core.ts:31');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'ledger-core.ts:90' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'notify-relay/send.ts:7' }),
    );
  });

  it('closes on Escape and returns focus to the diff', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord({ word: 'creditKey' }).host);
    await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const grid = screen.getByRole('grid', { name: 'Changes in ledger-core.ts' });
    expect(document.activeElement?.contains(grid)).toBe(true);
  });
});
