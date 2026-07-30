// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiffView, SessionId } from '@goodboy/types';

type DiffViewSelectorMockProps = {
  view: DiffView;
  onChange: (view: DiffView) => void;
};

const { state, fixtures } = vi.hoisted(() => ({
  state: {
    settings: {} as Record<string, string>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessions: [
      {
        id: 's1',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic' },
      },
    ],
    workspaceOverrides: {} as Record<string, { taskModels: Record<string, unknown> | null }>,
    providers: [{ id: 'anthropic', connection: 'connected' }],
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
    status: {
      head: null,
      headSubject: null,
      unstaged: 0,
      staged: 0,
      untracked: 0,
      hasUpstream: false,
      branch: null,
      ahead: 0,
      behind: 0,
      commitsAheadOfMain: 2,
      commitsBehindMain: 3,
      changed: 0,
    },
  },
}));

const scrollIntoViewMock = vi.fn();

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
  worktreeStatus: vi.fn(async () => fixtures.status),
}));

vi.mock('../DiffViewSelector', () => ({
  DiffViewSelector: ({ view, onChange }: DiffViewSelectorMockProps) => (
    <button type="button" onClick={() => onChange({ kind: 'working', scope: 'staged' })}>
      {view.kind === 'branch' ? 'branch vs main' : 'staged only'}
    </button>
  ),
}));

vi.mock('@goodboy/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core')>()),
  parseUnifiedDiff: () => fixtures.files,
}));

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoViewMock,
  });
  scrollIntoViewMock.mockReset();
  state.settings = {};
  state.sessionPhaseRuns = {};
  state.workspaceOverrides = {};
  state.loadDiffComments = vi.fn(async () => undefined);
  state.addDiffComment = vi.fn(async () => undefined);
  state.selectAgent.mockClear();
  state.spawnAgent.mockClear();
  fixtures.files = [];
  fixtures.comments = [];
  fixtures.status.hasUpstream = false;
  fixtures.status.branch = null;
  fixtures.status.ahead = 0;
  fixtures.status.behind = 0;
  fixtures.status.commitsAheadOfMain = 2;
  fixtures.status.commitsBehindMain = 3;
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    render(<DiffViewerPane onClose={vi.fn()} />);
    expect(await screen.findByText(/no diff source configured/i)).toBeDefined();
  });

  it('renders the canonical pane header without studio chrome', () => {
    const { container } = render(<DiffViewerPane onClose={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: /^diff$/i });
    expect(heading.className).toContain('text-xl');
    expect(heading.className).toContain('font-semibold');
    expect(screen.getByText("Changes across this session's working tree.")).toBeDefined();
    expect(screen.queryByText('acme')).toBeNull();
    expect(screen.queryByText('beta')).toBeNull();
    expect(container.firstElementChild?.className).toContain('motion-safe:animate-studio-in');
  });

  it('centers the pane content at the widest section width', () => {
    const { container } = render(<DiffViewerPane onClose={vi.fn()} />);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('mx-auto');
    expect(shell.className).toContain('max-w-5xl');
    expect(shell.className).not.toContain('fixed');
  });

  it('shows a compact refresh action for an empty default pane view', async () => {
    const { container } = render(<DiffViewerPane worktreePath="/tmp/worktree" onClose={vi.fn()} />);
    expect(await screen.findByText('Branch matches main')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'branch vs main' })).toBeNull();
    expect(screen.queryByRole('button', { name: /file list/i })).toBeNull();
    const refresh = screen.getByRole('button', { name: 'refresh git state' });
    expect(refresh).toBeDefined();
    expect(refresh.parentElement?.className).toContain('gap-1.5');
    expect(refresh.parentElement?.className).toContain('pt-0.5');
    expect(container.querySelector('[class*="max-w-2xl"]')).toBeNull();
  });

  it('keeps the selector available when a non-default pane view becomes empty', async () => {
    fixtures.files = fileFixture();
    render(<DiffViewerPane worktreePath="/tmp/worktree" onClose={vi.fn()} />);
    await screen.findByText(/alpha/);
    fixtures.files = [];
    fireEvent.click(screen.getByRole('button', { name: 'branch vs main' }));
    expect(await screen.findByText('No staged changes')).toBeDefined();
    expect(screen.getByRole('button', { name: 'staged only' })).toBeDefined();
  });

  it('shows selector controls and main-relative commit metadata for a non-empty diff', async () => {
    fixtures.files = fileFixture();
    fixtures.status.hasUpstream = true;
    Object.assign(fixtures.status, { branch: 'feature' });
    fixtures.status.ahead = 2;
    fixtures.status.behind = 1;
    render(<DiffViewerPane worktreePath="/tmp/worktree" onClose={vi.fn()} />);
    expect(await screen.findByText(/alpha/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'branch vs main' })).toBeDefined();
    expect(await screen.findByText('2 commits')).toBeDefined();
    expect(screen.getByText('behind main by 3')).toBeDefined();
    expect(screen.getByTitle('commits on main not in this branch')).toBeDefined();
    expect(screen.getByTitle('unpushed commits')).toBeDefined();
    expect(screen.getByTitle('behind upstream')).toBeDefined();
    expect(screen.queryByText('1 file')).toBeNull();
  });

  it('spawns a rebase agent with the resolved task model when behind main', async () => {
    fixtures.files = fileFixture();
    state.workspaceOverrides = {
      'workspace-1': {
        taskModels: {
          rebase: { providerId: 'codex', model: 'gpt-5.4' },
        },
      },
    };
    render(<DiffViewerPane sessionId={SID} worktreePath="/tmp/worktree" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rebase' }));

    await waitFor(() => expect(state.spawnAgent).toHaveBeenCalledOnce());
    expect(state.spawnAgent).toHaveBeenCalledWith(
      SID,
      expect.objectContaining({
        name: 'Rebase on main',
        provider: 'codex',
        model: 'gpt-5.4',
        effort: 'low',
      }),
    );
    await waitFor(() => expect(state.selectAgent).toHaveBeenCalledWith(SID, 'a1'));
  });

  it('surfaces rebase agent failures beside the action', async () => {
    fixtures.files = fileFixture();
    state.spawnAgent.mockRejectedValueOnce(new Error('agent launch failed'));
    render(<DiffViewerPane sessionId={SID} worktreePath="/tmp/worktree" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rebase' }));

    expect((await screen.findByRole('alert')).textContent).toContain('agent launch failed');
  });

  it('does not show the rebase action when the branch is not behind main', async () => {
    fixtures.files = fileFixture();
    fixtures.status.commitsBehindMain = 0;
    render(<DiffViewerPane sessionId={SID} worktreePath="/tmp/worktree" onClose={vi.fn()} />);

    expect(await screen.findByText('2 commits')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Rebase' })).toBeNull();
  });

  it('disables rebase while the session rebase agent is running', async () => {
    fixtures.files = fileFixture();
    state.sessionPhaseRuns = {
      [SID]: [{ name: 'Rebase on main', status: 'running' }],
    };
    render(<DiffViewerPane sessionId={SID} worktreePath="/tmp/worktree" onClose={vi.fn()} />);

    const button = await screen.findByRole('button', { name: 'Rebase' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('Rebase agent is still running');
  });
});

describe('line comment add (single + multi-line drag)', () => {
  it('single click on a line number opens a single-line composer', async () => {
    fixtures.files = fileFixture();
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    await screen.findByText(/alpha/);
    const lineNumbers = screen.getAllByLabelText('comment on line 1');
    fireEvent.pointerDown(lineNumbers[0]!);
    fireEvent.pointerUp(window);
    const composerLabel = await screen.findByText('commenting on line 1');
    const scrollContent = composerLabel.closest('[data-diff-scroll-content]');
    expect(scrollContent?.className).toContain('sticky');
    expect(scrollContent?.className).toContain('left-0');
    expect(scrollContent?.className).toContain('w-[var(--diff-card-width)]');
  });

  it('dragging a line number across rows opens a range composer and persists endLineNumber', async () => {
    fixtures.files = fileFixture();
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    await screen.findByText(/alpha/);
    const lineNumbers = screen.getAllByLabelText('comment on line 1');
    fireEvent.pointerDown(lineNumbers[0]!);
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
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    expect(await screen.findByText('lines 2–3')).toBeDefined();
    expect(screen.getByText('spans a range')).toBeDefined();
  });

  it('keeps colSpan controls sticky within the wide diff table', async () => {
    const lines = Array.from({ length: 1001 }, (_, index) => ({
      kind: 'add',
      oldLine: null,
      newLine: index + 1,
      text: `line-${index + 1}`,
    }));
    fixtures.files = [
      {
        path: 'src/large.ts',
        status: 'modified',
        additions: lines.length,
        deletions: 0,
        binary: false,
        hunks: [
          {
            header: '@@ -1,0 +1,1001 @@',
            oldStart: 1,
            oldLines: 0,
            newStart: 1,
            newLines: lines.length,
            lines,
          },
        ],
      },
    ];
    fixtures.comments = [
      {
        id: 'c1',
        sessionId: SID,
        filePath: 'src/large.ts',
        body: 'sticky note',
        status: 'open',
        createdAt: '2026-06-13T00:00:00.000Z',
        anchor: { side: 'new', lineNumber: 2 },
      },
    ];
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    const showMoreButton = await screen.findByRole('button', { name: /show 1 more lines/i });
    fireEvent.pointerDown(screen.getAllByLabelText('comment on line 1')[0]!);
    fireEvent.pointerUp(window);

    const scrollContents = [
      screen.getByText('sticky note').closest('[data-diff-scroll-content]'),
      (await screen.findByText('commenting on line 1')).closest('[data-diff-scroll-content]'),
      showMoreButton.closest('[data-diff-scroll-content]'),
    ];

    for (const scrollContent of scrollContents) {
      expect(scrollContent?.className).toContain('sticky');
      expect(scrollContent?.className).toContain('left-0');
      expect(scrollContent?.className).toContain('w-[var(--diff-card-width)]');
      expect(scrollContent?.parentElement?.tagName).toBe('TD');
      expect(scrollContent?.parentElement?.getAttribute('colspan')).toBe('3');
    }
  });

  it('opens file notes from the header action without a body call to action', async () => {
    fixtures.files = fileFixture();
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);

    const addFileNote = await screen.findByRole('button', { name: 'add file note' });
    expect(screen.queryByText('Add file note')).toBeNull();
    fireEvent.click(addFileNote);
    expect(await screen.findByPlaceholderText(/note for the agent/i)).toBeDefined();
  });

  it('offers a routing picker for the resolver spawned from open notes', async () => {
    fixtures.files = fileFixture();
    fixtures.comments = [
      {
        id: 'c1',
        sessionId: SID,
        filePath: 'src/a.ts',
        body: 'please fix',
        status: 'open',
        createdAt: '2026-06-13T00:00:00.000Z',
        anchor: { side: 'new', lineNumber: 2 },
      },
    ];
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    const picker = await screen.findByRole('button', { name: /^resolver routing:/ });
    expect(picker.getAttribute('aria-label')).toContain('Claude');
    expect(picker.textContent).toContain('Medium');
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
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    await screen.findByText(/alpha/);
    expect(screen.getByText(/bravo/)).toBeDefined();
    expect(screen.getAllByText('src/a.ts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('src/b.ts').length).toBeGreaterThan(0);
  });

  it('gives each file table its own horizontal scrollbar without wrapping code', async () => {
    fixtures.files = fileFixture();
    const { container } = render(
      <DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />,
    );
    await screen.findByText(/alpha/);
    const table = container.querySelector('table');
    const codeCell = screen.getByText(/alpha/).closest('td');
    expect(table?.parentElement?.className).toContain('overflow-x-auto');
    expect(table?.className).toContain('w-max');
    expect(codeCell?.className).toContain('whitespace-pre');
  });
});

describe('per-file reviewed state', () => {
  it('marking a file viewed collapses it, updates progress, and persists', async () => {
    fixtures.files = twoFileFixture();
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    await screen.findByText(/alpha/);
    const viewedButtons = screen.getAllByRole('button', { name: /viewed/i });
    fireEvent.click(viewedButtons[0]!);
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
    render(<DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />);
    await screen.findByText(/alpha/);
    expect(screen.getByText(/previously reviewed/i)).toBeDefined();
  });
});

const flushMicrotasks = () => act(async () => {});

const makeFiles = (count: number, prefix = 'file') =>
  Array.from({ length: count }, (_, i) => ({
    path: `src/${prefix}${i}.ts`,
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
        lines: [{ kind: 'add', oldLine: null, newLine: 1, text: `${prefix}${i}` }],
      },
    ],
  }));

describe('progressive batching', () => {
  it('mounts and scrolls to a file beyond the first batch when its rail entry is clicked', async () => {
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    localStorage.setItem('goodboy:diff-sidebar-collapsed', '0');
    fixtures.files = makeFiles(25);
    const { container } = render(
      <DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />,
    );

    await screen.findByTitle('src/file22.ts');
    expect(container.querySelector('[data-file-path="src/file22.ts"]')).toBeNull();
    fireEvent.click(screen.getByTitle('src/file22.ts'));

    await waitFor(() => {
      const fileCard = container.querySelector('[data-file-path="src/file22.ts"]');
      expect(fileCard).not.toBeNull();
      expect(scrollIntoViewMock.mock.contexts).toContain(fileCard);
    });
  });

  it('mounts only the first batch initially and appends more after idle', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    fixtures.files = makeFiles(25);
    const { container } = render(
      <DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />,
    );

    await flushMicrotasks();

    const countAfterFirst = container.querySelectorAll('[data-file-path]').length;
    expect(countAfterFirst).toBeLessThanOrEqual(20);
    expect(countAfterFirst).toBeGreaterThan(0);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(container.querySelectorAll('[data-file-path]').length).toBe(25);

    vi.useRealTimers();
  });

  it('resets batch count when the diff source changes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    fixtures.files = makeFiles(25, 'a');
    const { container, rerender } = render(
      <DiffViewerPane sessionId={SID} loader={async () => 'raw'} onClose={vi.fn()} />,
    );

    await flushMicrotasks();
    await act(async () => {
      vi.runAllTimers();
    });
    expect(container.querySelectorAll('[data-file-path]').length).toBe(25);

    fixtures.files = makeFiles(25, 'b');
    rerender(<DiffViewerPane sessionId={SID} loader={async () => 'raw2'} onClose={vi.fn()} />);
    await flushMicrotasks();

    const countAfterReset = container.querySelectorAll('[data-file-path]').length;
    expect(countAfterReset).toBeLessThanOrEqual(20);
    expect(countAfterReset).toBeGreaterThan(0);

    await act(async () => {
      vi.runAllTimers();
    });
    expect(container.querySelectorAll('[data-file-path]').length).toBe(25);

    vi.useRealTimers();
  });
});

describe('DiffViewerDialog vs DiffViewerPane structural difference', () => {
  it('DiffViewerDialog uses a fixed overlay and DiffViewerPane uses centered pane layout', () => {
    const { container: dialogContainer } = render(<DiffViewerDialog open onClose={vi.fn()} />);
    const { container: paneContainer } = render(<DiffViewerPane onClose={vi.fn()} />);
    const dialogRoot = dialogContainer.querySelector('dialog, [role="dialog"]');
    expect(dialogRoot).not.toBeNull();

    const paneShell = paneContainer.firstElementChild as HTMLElement;
    expect(paneShell.className).toContain('mx-auto');
    expect(paneShell.className).toContain('max-w-5xl');
    expect(paneShell.className).not.toContain('fixed');
  });
});
