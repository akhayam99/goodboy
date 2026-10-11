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

vi.mock('../../hooks/useDiffReviewThreads', () => ({
  useDiffReviewThreads: () => ({
    threads: [],
    onReply: vi.fn(),
    onResolve: vi.fn(),
    onOpenInComments: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDiffNotes', () => ({
  useDiffNotes: () => ({ threads: [], allowFileLevel: false }),
}));

vi.mock('../../hooks/useDiffTokens', () => ({
  useDiffTokens: () => null,
  tokensForLine: () => null,
}));

vi.mock('../../../permissions/components/DiffViewSelector', () => ({
  DiffViewSelector: () => <button type="button">Comparing</button>,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useMemo, useState } from 'react';
import type { FileDiff, SessionId } from '@goodboy/types';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { SessionDiff } from '../../hooks/useSessionDiff';
import { DiffRailHarness } from '../../../../__tests__/helpers/DiffRailHarness';
import { SessionDiffPane } from './index';

const SESSION_ID = 'session-1' as SessionId;
const WORKTREE = '/w/ledger';
const FILE_COUNT = 60;

const fileAt = (index: number): FileDiff => ({
  path: `ledger-core/src/f${String(index).padStart(2, '0')}.ts`,
  status: 'modified',
  additions: 1,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [
        { kind: 'del', oldLine: 1, newLine: null, text: 'old' },
        { kind: 'add', oldLine: null, newLine: 1, text: 'new' },
      ],
    },
  ],
});

const FILES: ReadonlyArray<FileDiff> = Array.from({ length: FILE_COUNT }, (_, index) =>
  fileAt(index),
);

type HostProps = {
  readonly initialFocus?: string | null;
  readonly isOverlay?: boolean;
};

const Host = ({ initialFocus = null, isOverlay = false }: HostProps) => {
  const [focusPath, setFocusPath] = useState<string | null>(initialFocus);
  const [viewedPaths, setViewedPaths] = useState<ReadonlyArray<string>>([]);
  const diff = useMemo<SessionDiff>(
    () => ({
      files: FILES,
      patch: '',
      loading: false,
      isRefreshing: false,
      error: null,
      view: { kind: 'branch' },
      setView: vi.fn(),
      alternate: null,
      commits: [],
      status: null,
      metaError: null,
      refresh: vi.fn(),
      viewed: {
        stateOf: (file) => (viewedPaths.includes(file.path) ? 'viewed' : 'none'),
        onToggle: (file, next) =>
          setViewedPaths((current) =>
            next ? [...current, file.path] : current.filter((path) => path !== file.path),
          ),
      },
      focusPath,
      focusThreadId: null,
      clearFocus: () => setFocusPath(null),
    }),
    [focusPath, viewedPaths],
  );
  return (
    <DiffRailHarness isOverlay={isOverlay}>
      <SessionDiffPane
        sessionId={SESSION_ID}
        workingDir={WORKTREE}
        worktreePath={WORKTREE}
        diff={diff}
      />
    </DiffRailHarness>
  );
};

const scrolled: Array<string | null> = [];

beforeEach(() => {
  scrolled.length = 0;
  localStorage.clear();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: function (this: Element) {
      scrolled.push(this.getAttribute('data-file-path'));
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sections = () => document.querySelectorAll('[data-file-path]');

const nameOf = (index: number): RegExp => new RegExp(`f${String(index).padStart(2, '0')}\\.ts`);

const treeItem = (index: number) =>
  within(screen.getByRole('navigation', { name: 'Changed files' })).getByRole('treeitem', {
    name: nameOf(index),
  });

const treeRow = (index: number) =>
  within(treeItem(index)).getByRole('button', {
    name: new RegExp(`^f${String(index).padStart(2, '0')}\\.ts`),
  });

describe('SessionDiffPane with the real DiffView', () => {
  it('scrolls the content to the file whose tree row was clicked', async () => {
    render(<Host />);

    fireEvent.click(treeRow(45));

    await waitFor(() => expect(scrolled).toContain(fileAt(45).path));
  });

  it('scrolls on every click, far and near, one after another', async () => {
    render(<Host />);

    fireEvent.click(treeRow(45));
    await waitFor(() => expect(scrolled).toContain(fileAt(45).path));
    fireEvent.click(treeRow(3));
    await waitFor(() => expect(scrolled).toContain(fileAt(3).path));
    fireEvent.click(treeRow(58));
    await waitFor(() => expect(scrolled).toContain(fileAt(58).path));
  });

  it('follows j and k to the next and previous file', async () => {
    render(<Host />);
    fireEvent.click(treeRow(10));
    await waitFor(() => expect(scrolled).toContain(fileAt(10).path));

    pressShortcut({ id: 'diff.fileDown' });
    await waitFor(() => expect(scrolled).toContain(fileAt(11).path));
    pressShortcut({ id: 'diff.fileUp' });
    pressShortcut({ id: 'diff.fileUp' });

    await waitFor(() => expect(scrolled).toContain(fileAt(9).path));
  });

  it('follows j and k with the rail hidden, and marks the file in the tree once it opens', async () => {
    render(<Host isOverlay />);
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();

    pressShortcut({ id: 'diff.fileDown' });
    await waitFor(() => expect(scrolled).toContain(fileAt(0).path));
    pressShortcut({ id: 'diff.fileDown' });
    await waitFor(() => expect(scrolled).toContain(fileAt(1).path));
    pressShortcut({ id: 'diff.fileUp' });
    await waitFor(() => expect(scrolled.at(-1)).toBe(fileAt(0).path));

    pressShortcut({ id: 'diff.focusTree' });
    expect(treeItem(0).getAttribute('aria-current')).toBe('true');
    expect(treeItem(1).getAttribute('aria-current')).toBeNull();
  });

  it('keeps j and k moving after the hidden rail opens and a pick closes it', async () => {
    render(<Host isOverlay />);
    pressShortcut({ id: 'diff.focusTree' });
    fireEvent.click(treeRow(10));
    await waitFor(() => expect(scrolled).toContain(fileAt(10).path));
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();

    pressShortcut({ id: 'diff.fileDown' });
    await waitFor(() => expect(scrolled).toContain(fileAt(11).path));

    pressShortcut({ id: 'diff.focusTree' });
    expect(treeItem(11).getAttribute('aria-current')).toBe('true');
  });

  it('marks the file viewed and scrolls to the next unviewed one', async () => {
    render(<Host />);
    fireEvent.click(treeRow(0));
    await waitFor(() => expect(scrolled).toContain(fileAt(0).path));

    pressShortcut({ id: 'diff.markViewed' });

    await waitFor(() => expect(scrolled).toContain(fileAt(1).path));
  });

  it('keeps every mounted file when a file is marked viewed', async () => {
    render(<Host />);
    await waitFor(() => expect(sections()).toHaveLength(FILE_COUNT), { timeout: 5000 });
    const before = Array.from(sections());

    fireEvent.click(treeRow(0));
    pressShortcut({ id: 'diff.markViewed' });

    await waitFor(() => expect(scrolled).toContain(fileAt(1).path));
    expect(sections()).toHaveLength(FILE_COUNT);
    expect(Array.from(sections()).every((node, index) => node === before[index])).toBe(true);
  });

  it('still honours a deep link whose focus the parent clears at once', async () => {
    render(<Host initialFocus={fileAt(45).path} />);

    await waitFor(() => expect(scrolled).toContain(fileAt(45).path));
  });
});
