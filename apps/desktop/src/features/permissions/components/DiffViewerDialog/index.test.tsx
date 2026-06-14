// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, fixtures } = vi.hoisted(() => ({
  state: {
    settings: {} as Record<string, string>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    loadDiffComments: vi.fn(async () => undefined),
    addDiffComment: vi.fn(async () => undefined),
    resolveDiffComment: vi.fn(async () => undefined),
    consumeDiffComments: vi.fn(async () => undefined),
    reopenDiffComment: vi.fn(async () => undefined),
    deleteDiffComment: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    spawnAgent: vi.fn(async () => 'a1'),
    sendTurn: vi.fn(async () => undefined),
  },
  fixtures: {
    files: [] as ReadonlyArray<unknown>,
    comments: [] as ReadonlyArray<unknown>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useDiffComments: () => fixtures.comments,
  useSummarizerStatus: () => ({ status: 'idle' }),
}));

vi.mock('../../../../features/github/github', () => ({
  ghPrDiff: vi.fn(async () => ''),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  listBranchCommits: vi.fn(async () => []),
  worktreeDiff: vi.fn(async () => ''),
  worktreeDiffCommit: vi.fn(async () => ''),
  worktreeDiffWorking: vi.fn(async () => ''),
  worktreeStatus: vi.fn(async () => ({
    head: null,
    headSubject: null,
    unstaged: 0,
    staged: 0,
    untracked: 0,
    hasUpstream: false,
    branch: null,
    ahead: 0,
    behind: 0,
  })),
}));

vi.mock('../DiffViewSelector', () => ({
  DiffViewSelector: () => null,
}));

vi.mock('@goodboy/core', () => ({
  parseUnifiedDiff: () => fixtures.files,
}));

beforeEach(() => {
  state.settings = {};
  state.sessionPhaseRuns = {};
  state.loadDiffComments = vi.fn(async () => undefined);
  state.addDiffComment = vi.fn(async () => undefined);
  fixtures.files = [];
  fixtures.comments = [];
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
afterEach(cleanup);

import type { SessionId } from '@goodboy/types';
import { DiffViewerDialog, DiffViewerPane } from './index';

const SID = 's1' as SessionId;

const fileFixture = () => [
  {
    path: 'src/a.ts',
    status: 'modified',
    additions: 3,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -1,0 +1,3 @@',
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 3,
        lines: [
          { kind: 'add', oldLine: null, newLine: 1, text: 'alpha' },
          { kind: 'add', oldLine: null, newLine: 2, text: 'beta' },
          { kind: 'add', oldLine: null, newLine: 3, text: 'gamma' },
        ],
      },
    ],
  },
];

describe('DiffViewerDialog', () => {
  it('renders an empty-state with the no-source error when no loader is configured', async () => {
    render(<DiffViewerDialog open onClose={vi.fn()} />);
    expect(await screen.findByText(/no diff source configured/i)).toBeDefined();
  });

  it('renders close button when open', () => {
    render(<DiffViewerDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^close$/i })).toBeDefined();
  });
});

describe('DiffViewerPane', () => {
  it('mounts content without an open gate and surfaces the no-source error', async () => {
    render(<DiffViewerPane workspaceName="acme" onClose={vi.fn()} />);
    expect(await screen.findByText(/no diff source configured/i)).toBeDefined();
  });

  it('renders the studio header for the overlay slot', () => {
    render(<DiffViewerPane workspaceName="acme" onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /files touched/i })).toBeDefined();
    expect(screen.getByText('acme')).toBeDefined();
  });

  it('uses variant="slot" (relative positioning, not fixed)', () => {
    const { container } = render(<DiffViewerPane workspaceName="acme" onClose={vi.fn()} />);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('relative');
    expect(shell.className).not.toContain('fixed');
    expect(shell.className).not.toContain('z-50');
  });

  it('Escape requests close', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<DiffViewerPane workspaceName="acme" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('Done button requests close', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<DiffViewerPane workspaceName="acme" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close files touched/i }));
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('renders the beta badge', () => {
    render(<DiffViewerPane workspaceName="acme" onClose={vi.fn()} />);
    expect(screen.getByText('beta')).toBeDefined();
  });
});

describe('line comment add (single + multi-line drag)', () => {
  it('single click on the gutter opens a single-line composer', async () => {
    fixtures.files = fileFixture();
    render(
      <DiffViewerPane
        workspaceName="acme"
        sessionId={SID}
        loader={async () => 'raw'}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(/alpha/);
    const btns = screen.getAllByLabelText('comment on this line');
    fireEvent.pointerDown(btns[0]);
    fireEvent.pointerUp(window);
    expect(await screen.findByText('commenting on line 1')).toBeDefined();
  });

  it('dragging the gutter across lines opens a range composer and persists endLineNumber', async () => {
    fixtures.files = fileFixture();
    render(
      <DiffViewerPane
        workspaceName="acme"
        sessionId={SID}
        loader={async () => 'raw'}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(/alpha/);
    const btns = screen.getAllByLabelText('comment on this line');
    fireEvent.pointerDown(btns[0]);
    const lastRow = screen.getByText(/gamma/).closest('tr');
    expect(lastRow).not.toBeNull();
    fireEvent.mouseEnter(lastRow as HTMLElement);
    fireEvent.pointerUp(window);
    expect(await screen.findByText('commenting on lines 1–3')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/note for the agent/i), {
      target: { value: 'range note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    expect(state.addDiffComment).toHaveBeenCalledWith(SID, 'src/a.ts', 'range note', {
      side: 'new',
      lineNumber: 1,
      endLineNumber: 3,
    });
  });

  it('renders a range badge for an existing multi-line comment', async () => {
    fixtures.files = fileFixture();
    fixtures.comments = [
      {
        id: 'c1',
        sessionId: SID,
        filePath: 'src/a.ts',
        body: 'spans a range',
        status: 'open',
        createdAt: '2026-06-13T00:00:00.000Z',
        anchor: { side: 'new', lineNumber: 2, endLineNumber: 3 },
      },
    ];
    render(
      <DiffViewerPane
        workspaceName="acme"
        sessionId={SID}
        loader={async () => 'raw'}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText('lines 2–3')).toBeDefined();
    expect(screen.getByText('spans a range')).toBeDefined();
  });
});

const twoFileFixture = () => [
  {
    path: 'src/a.ts',
    status: 'modified',
    additions: 1,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -1,0 +1,1 @@',
        oldStart: 1,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'alpha' }],
      },
    ],
  },
  {
    path: 'src/b.ts',
    status: 'added',
    additions: 1,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,1 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'bravo' }],
      },
    ],
  },
];

describe('single-scroll all-files layout', () => {
  it('renders every file in one scroll, not one at a time', async () => {
    fixtures.files = twoFileFixture();
    render(
      <DiffViewerPane
        workspaceName="acme"
        sessionId={SID}
        loader={async () => 'raw'}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(/alpha/);
    expect(screen.getByText(/bravo/)).toBeDefined();
    expect(screen.getAllByText('src/a.ts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('src/b.ts').length).toBeGreaterThan(0);
  });
});

describe('per-file reviewed state', () => {
  it('marking a file viewed collapses it, updates progress, and persists', async () => {
    fixtures.files = twoFileFixture();
    render(
      <DiffViewerPane
        workspaceName="acme"
        sessionId={SID}
        loader={async () => 'raw'}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(/alpha/);
    const viewedButtons = screen.getAllByRole('button', { name: /viewed/i });
    fireEvent.click(viewedButtons[0]);
    expect(await screen.findByText(/1\/2 reviewed/)).toBeDefined();
    expect(screen.queryByText(/alpha/)).toBeNull();
    expect(localStorage.getItem(`goodboy:diff-reviewed:${SID}:branch`)).not.toBeNull();
  });

  it('shows "previously reviewed" when a reviewed file changed since', async () => {
    localStorage.setItem(
      `goodboy:diff-reviewed:${SID}:branch`,
      JSON.stringify({ 'src/a.ts': 'stale-signature' }),
    );
    fixtures.files = twoFileFixture();
    render(
      <DiffViewerPane
        workspaceName="acme"
        sessionId={SID}
        loader={async () => 'raw'}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(/alpha/);
    expect(screen.getByText(/previously reviewed/i)).toBeDefined();
  });
});

describe('DiffViewerDialog vs DiffViewerPane structural difference', () => {
  it('DiffViewerDialog uses fixed overlay (Dialog), DiffViewerPane uses slot layout', () => {
    const { container: dialogContainer } = render(<DiffViewerDialog open onClose={vi.fn()} />);
    const { container: paneContainer } = render(
      <DiffViewerPane workspaceName="acme" onClose={vi.fn()} />,
    );
    const dialogRoot = dialogContainer.querySelector('dialog, [role="dialog"]');
    expect(dialogRoot).not.toBeNull();

    const paneShell = paneContainer.firstElementChild as HTMLElement;
    expect(paneShell.className).toContain('relative');
    expect(paneShell.className).not.toContain('fixed');
  });
});
