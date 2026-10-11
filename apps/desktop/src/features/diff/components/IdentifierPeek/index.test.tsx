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

const grep = (matches: ReadonlyArray<GrepMatch>, isTruncated = false) => ({
  worktree_grep_word: { matches, truncated: isTruncated },
  worktree_file_sides: SIDES,
});

type Selected = { readonly node: Text; readonly host: Element };

const selectWord = (word: string): Selected => {
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

const renderDiff = (onOpenElsewhere: (match: GrepMatch) => void = () => undefined) =>
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
  stubStoryInvoke(grep([OTHER_FILE, DEFINITION, HIDDEN]));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('identifier peek', () => {
  it('opens on a double click with a defined group and a used group', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord('creditKey').host);
    const dialog = await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    expect(await within(dialog).findByText(/Defined in 1 place/)).toBeDefined();
    expect(within(dialog).getByText(/Used in 2 places/)).toBeDefined();
    const defined = within(dialog).getByRole('group', { name: 'Defined in' });
    expect(within(defined).getByRole('button', { name: 'ledger-core.ts:31' })).toBeDefined();
    expect(within(defined).getByText('In this change')).toBeDefined();
    const used = within(dialog).getByRole('group', { name: 'Used in' });
    expect(within(used).getByRole('button', { name: 'notify-relay/send.ts:7' })).toBeDefined();
  });

  it('opens on an alt click through the caret under the pointer', async () => {
    renderDiff();
    const { host, node } = selectWord('creditKey');
    const at = (node.textContent ?? '').indexOf('creditKey') + 2;
    window.getSelection()?.removeAllRanges();
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at);
    Object.assign(document, { caretRangeFromPoint: () => range });
    fireEvent.click(host, { altKey: true });
    expect(await screen.findByRole('dialog', { name: 'Uses of creditKey' })).toBeDefined();
    Object.assign(document, { caretRangeFromPoint: undefined });
  });

  it('ignores a double click on something that is not an identifier', () => {
    renderDiff();
    fireEvent.doubleClick(selectWord('= 1').host);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a truncation note', async () => {
    stubStoryInvoke(grep([DEFINITION], true));
    renderDiff();
    fireEvent.doubleClick(selectWord('creditKey').host);
    expect(await screen.findByText('Showing the first 300.')).toBeDefined();
  });

  it('says so when the search fails', async () => {
    stubStoryInvoke({
      worktree_grep_word: () => Promise.reject(new Error('the search took too long')),
    });
    renderDiff();
    fireEvent.doubleClick(selectWord('creditKey').host);
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText(/the search took too long/)).toBeDefined();
  });

  it('Enter on a result in a visible changed line scrolls the diff and flashes it', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const open = vi.fn();
    renderDiff(open);
    fireEvent.doubleClick(selectWord('creditKey').host);
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
    renderDiff(open);
    fireEvent.doubleClick(selectWord('creditKey').host);
    await userEvent.click(await screen.findByRole('button', { name: 'ledger-core.ts:90' }));
    await waitFor(() =>
      expect(document.querySelector('[data-peek-flash] [data-line="new:90"]')).not.toBeNull(),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the Explore drawer for a result in a file outside this diff', async () => {
    const open = vi.fn();
    renderDiff(open);
    fireEvent.doubleClick(selectWord('creditKey').host);
    await userEvent.click(await screen.findByRole('button', { name: 'notify-relay/send.ts:7' }));
    expect(open).toHaveBeenCalledWith(OTHER_FILE);
  });

  it('moves between results with the arrow keys', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord('creditKey').host);
    await screen.findByRole('button', { name: 'ledger-core.ts:31' });
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('ledger-core.ts:31');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('notify-relay/send.ts:7');
  });

  it('closes on Escape and returns focus to the diff', async () => {
    renderDiff();
    fireEvent.doubleClick(selectWord('creditKey').host);
    await screen.findByRole('dialog', { name: 'Uses of creditKey' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const grid = screen.getByRole('grid', { name: 'Changes in ledger-core.ts' });
    expect(document.activeElement?.contains(grid)).toBe(true);
  });
});
