// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { CommentThread } from './CommentThread';
import type { ReactElement } from 'react';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { DiffView } from '.';
import type { DiffComments, DiffThread } from './types';

vi.mock('../../hooks/useDiffTokens', () => ({
  useDiffTokens: () => null,
  tokensForLine: () => null,
}));

const FILE: FileDiff = {
  path: 'ledger-core/src/rows/LedgerRow.tsx',
  status: 'modified',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '@@ -10,3 +10,4 @@',
      oldStart: 10,
      oldLines: 3,
      newStart: 10,
      newLines: 4,
      lines: [
        { kind: 'context', oldLine: 10, newLine: 10, text: 'export const LedgerRow = () => {' },
        { kind: 'del', oldLine: 11, newLine: null, text: '  return <span>{row.amount}</span>;' },
        { kind: 'add', oldLine: null, newLine: 11, text: '  const label = format(row);' },
        { kind: 'add', oldLine: null, newLine: 12, text: '  return <span>{label}</span>;' },
        { kind: 'context', oldLine: 12, newLine: 13, text: '};' },
      ],
    },
  ],
};

const NOTE: DiffThread = {
  id: 'note-1',
  filePath: FILE.path,
  anchor: { side: 'new', lineNumber: 11 },
  body: 'Keep the note out of the row',
  tone: 'neutral',
  author: 'You',
  isAgent: false,
  source: 'note',
  host: null,
  createdAt: '2026-10-10T09:00:00.000Z',
  statusLabel: 'Open',
  isResolved: false,
  canEdit: true,
  canClose: true,
  canReopen: false,
};

const HOST: DiffThread = {
  id: 'review:PRRT_1',
  filePath: FILE.path,
  anchor: { side: 'new', lineNumber: 12 },
  body: 'This adds a line to every row. Is that intended?',
  tone: 'neutral',
  author: 'Cascadia Ops',
  authorAvatarUrl: null,
  isAgent: false,
  source: 'host',
  host: 'github',
  createdAt: '2026-10-10T08:00:00.000Z',
  statusLabel: 'Open',
  isResolved: false,
  replies: [
    { id: 'r1', author: 'Maya Ortiz', body: 'Yes, the credit note needs the extra line.' },
    { id: 'r2', author: 'Cascadia Ops', body: 'Fine, add it to the story then.' },
  ],
  canReply: true,
  canResolve: true,
  canEdit: false,
  canClose: false,
  canReopen: false,
  canDelete: false,
};

const commentsWith = (
  threads: ReadonlyArray<DiffThread>,
  extra: Partial<DiffComments> = {},
): DiffComments => ({
  threads,
  submitLabel: 'Add note',
  composerLabel: 'Note',
  noun: 'note',
  allowFileLevel: true,
  onSubmit: vi.fn(),
  onEdit: vi.fn(async () => undefined),
  onClose: vi.fn(),
  onReopen: vi.fn(),
  onDelete: vi.fn(),
  onReply: vi.fn(async () => undefined),
  onResolve: vi.fn(async () => undefined),
  onOpenInComments: vi.fn(),
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const noteCard = (): HTMLElement => screen.getByRole('article', { name: /^Note from You/ });

const hostCard = (): HTMLElement =>
  screen.getByRole('article', { name: /^On GitHub from Cascadia Ops/ });

describe('a note and a host thread on one file', () => {
  it('draw different chips and are both reachable by role', () => {
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([NOTE, HOST])} />);

    expect(within(noteCard()).getByText('Note')).toBeDefined();
    expect(within(hostCard()).getByText('On GitHub')).toBeDefined();
    expect(within(noteCard()).queryByText('On GitHub')).toBeNull();
    expect(within(hostCard()).queryByText('Note')).toBeNull();
    expect(within(hostCard()).getByText('Open')).toBeDefined();
  });

  it('give a note Edit, Close and Delete and no Reply, Resolve or Open in Comments', () => {
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([NOTE])} />);

    const card = noteCard();
    for (const name of ['Edit', 'Close note', 'Delete']) {
      expect(within(card).getByRole('button', { name })).toBeDefined();
    }
    for (const name of ['Reply', 'Resolve', 'Open in Comments']) {
      expect(within(card).queryByRole('button', { name })).toBeNull();
    }
  });

  it('give a host thread Reply, Resolve and Open in Comments and no Edit, Close or Delete', () => {
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([HOST])} />);

    const card = hostCard();
    for (const name of ['Reply', 'Resolve', 'Open in Comments']) {
      expect(within(card).getByRole('button', { name })).toBeDefined();
    }
    for (const name of ['Edit', 'Close note', 'Delete']) {
      expect(within(card).queryByRole('button', { name })).toBeNull();
    }
  });

  it('say how many replies a host thread has and show them', () => {
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([HOST])} />);

    const card = hostCard();
    expect(within(card).getByText('2 replies')).toBeDefined();
    const replies = within(card).getByRole('list', { name: 'Replies' });
    expect(within(replies).getAllByRole('listitem')).toHaveLength(2);
    expect(within(replies).getByText(/the credit note needs the extra line/)).toBeDefined();
  });
});

describe('a host thread in Files', () => {
  it('posts a reply through the reply verb and closes its composer', async () => {
    const comments = commentsWith([HOST]);
    renderWithMenu(<DiffView files={[FILE]} comments={comments} />);

    fireEvent.click(within(hostCard()).getByRole('button', { name: 'Reply' }));
    const box = screen.getByRole('textbox', { name: 'Reply to Cascadia Ops' });
    fireEvent.change(box, { target: { value: 'Done in 9e4c1a7' } });
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true });

    await waitFor(() =>
      expect(comments.onReply).toHaveBeenCalledWith('review:PRRT_1', 'Done in 9e4c1a7'),
    );
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
  });

  it('keeps the composer and says why when the reply fails', async () => {
    const onReply = vi.fn(async () => {
      throw new Error('GitHub refused the reply');
    });
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([HOST], { onReply })} />);

    fireEvent.click(within(hostCard()).getByRole('button', { name: 'Reply' }));
    const box = screen.getByRole('textbox', { name: 'Reply to Cascadia Ops' });
    fireEvent.change(box, { target: { value: 'Done' } });
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true });

    expect((await screen.findByRole('alert')).textContent).toContain('GitHub refused the reply');
    expect(screen.getByRole('textbox', { name: 'Reply to Cascadia Ops' })).toBeDefined();
  });

  it('resolves through the resolve verb', async () => {
    const comments = commentsWith([HOST]);
    renderWithMenu(<DiffView files={[FILE]} comments={comments} />);

    fireEvent.click(within(hostCard()).getByRole('button', { name: 'Resolve' }));

    await waitFor(() => expect(comments.onResolve).toHaveBeenCalledWith('review:PRRT_1'));
  });

  it('opens its thread in Comments', () => {
    const comments = commentsWith([HOST]);
    renderWithMenu(<DiffView files={[FILE]} comments={comments} />);

    fireEvent.click(within(hostCard()).getByRole('button', { name: 'Open in Comments' }));

    expect(comments.onOpenInComments).toHaveBeenCalledWith('review:PRRT_1');
  });

  it('offers no Reply when the host cannot take one, and no Resolve when it cannot resolve', () => {
    renderWithMenu(
      <DiffView
        files={[FILE]}
        comments={commentsWith([{ ...HOST, canReply: false, canResolve: false }])}
      />,
    );

    expect(within(hostCard()).queryByRole('button', { name: 'Reply' })).toBeNull();
    expect(within(hostCard()).queryByRole('button', { name: 'Resolve' })).toBeNull();
    expect(within(hostCard()).getByRole('button', { name: 'Open in Comments' })).toBeDefined();
  });

  it('names a resolved thread by its host and keeps it to one line', () => {
    renderWithMenu(
      <DiffView
        files={[FILE]}
        comments={commentsWith([{ ...HOST, isResolved: true, statusLabel: 'Resolved' }])}
      />,
    );

    const card = screen.getByRole('article', { name: /^On GitHub from Cascadia Ops, resolved/ });
    expect(card.getAttribute('data-thread-state')).toBe('resolved');
    expect(within(card).getByText('Resolved')).toBeDefined();
  });

  it('draws read only: no Reply, no Resolve, no Delete, the link to Comments stays', () => {
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([NOTE, HOST])} isReadOnly />);

    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(hostCard()).getByRole('button', { name: 'Open in Comments' })).toBeDefined();
  });
});

describe('a note in Files', () => {
  it('edits its text through the edit verb', () => {
    const comments = commentsWith([NOTE]);
    renderWithMenu(<DiffView files={[FILE]} comments={comments} />);

    fireEvent.click(within(noteCard()).getByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Edit note' });
    fireEvent.change(box, { target: { value: 'Keep the note out of the row, please' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(comments.onEdit).toHaveBeenCalledWith('note-1', 'Keep the note out of the row, please');
  });

  it('closes the editor once the edit is saved', async () => {
    const comments = commentsWith([NOTE]);
    renderWithMenu(<DiffView files={[FILE]} comments={comments} />);

    fireEvent.click(within(noteCard()).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit note' }), {
      target: { value: 'Saved text' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Edit note' })).toBeNull());
  });

  it('keeps the editor, the typed text and shows the error when the edit fails', async () => {
    const onEdit = vi.fn(async () => {
      throw new Error('Database is locked');
    });
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([NOTE], { onEdit })} />);

    fireEvent.click(within(noteCard()).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit note' }), {
      target: { value: 'Text that must survive' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Database is locked');
    const box = screen.getByRole('textbox', { name: 'Edit note' });
    expect(box instanceof HTMLTextAreaElement && box.value).toBe('Text that must survive');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
  });

  it('shows what the triage slot is given, right after the kind chip', () => {
    render(
      <CommentThread
        thread={NOTE}
        comments={commentsWith([NOTE])}
        outcome={<span>Fix proposed</span>}
      />,
    );

    const card = noteCard();
    const chip = within(card).getByText('Note');
    const outcome = within(card).getByText('Fix proposed');
    expect(chip.compareDocumentPosition(outcome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('carries no per thread fix control', () => {
    renderWithMenu(<DiffView files={[FILE]} comments={commentsWith([NOTE, HOST])} />);

    expect(screen.queryByRole('button', { name: /^Fix/ })).toBeNull();
  });
});

const renderWithMenu = (ui: ReactElement) => render(<ObjectMenuProvider>{ui}</ObjectMenuProvider>);

const openFileMenu = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^More for / }));
};

describe('the file header', () => {
  const headerOf = (): HTMLElement => {
    const header = document.querySelector<HTMLElement>('[data-slot="diff-file-header"]');
    if (header === null) {
      throw new Error('no file header');
    }
    return header;
  };

  it('is 44 high and shows Viewed and the four file actions as icons at rest, each a 28 control', () => {
    renderWithMenu(
      <DiffView
        files={[FILE]}
        comments={commentsWith([NOTE, HOST])}
        viewed={{ stateOf: () => 'none', onToggle: vi.fn() }}
        fileActions={{ onOpenInEditor: vi.fn() }}
        loadFileSides={vi.fn()}
      />,
    );

    const header = headerOf();
    expect(header.style.height).toBe('44px');
    expect(within(header).getByRole('checkbox', { name: 'Viewed' })).toBeDefined();
    expect(within(header).getByRole('button', { name: 'Comment' }).getAttribute('data-size')).toBe(
      'sm',
    );
    for (const name of ['Open in editor', 'Show whole file', 'Copy path']) {
      expect(within(header).queryByRole('button', { name })).toBeNull();
    }
    openFileMenu();
    for (const name of ['Open in editor', 'Show whole file', 'Copy path']) {
      expect(screen.getByRole('menuitem', { name })).toBeDefined();
    }
  });

  it('counts the open threads of both kinds in the Comment tooltip and not the resolved ones', async () => {
    vi.useFakeTimers();
    renderWithMenu(
      <DiffView
        files={[FILE]}
        comments={commentsWith([
          NOTE,
          HOST,
          { ...HOST, id: 'review:PRRT_2', isResolved: true, statusLabel: 'Resolved' },
        ])}
      />,
    );

    fireEvent.mouseEnter(within(headerOf()).getByRole('button', { name: 'Comment' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByRole('tooltip').textContent).toBe('Comment, 2 open');
  });

  it('leaves the path to a fact card and carries no native title', async () => {
    vi.useFakeTimers();
    renderWithMenu(<DiffView files={[FILE]} />);
    expect(headerOf().querySelector('[title]')).toBeNull();

    fireEvent.pointerEnter(within(headerOf()).getByText('LedgerRow.tsx'), {
      pointerType: 'mouse',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    const card = within(screen.getByTestId('fact-card'));
    expect(card.getByText('LedgerRow.tsx')).toBeDefined();
    expect(card.getByText('Modified')).toBeDefined();
    expect(card.getByText('ledger-core/src/rows')).toBeDefined();
  });

  it('keeps the file name whole and the folders in front of it', () => {
    renderWithMenu(<DiffView files={[FILE]} />);

    const header = headerOf();
    expect(within(header).getByText('LedgerRow.tsx')).toBeDefined();
    expect(within(header).getByText('ledger-core/src/rows/')).toBeDefined();
  });

  it('folds the file when Viewed is checked and shows an amber dot when it went stale', async () => {
    vi.useFakeTimers();
    const onToggle = vi.fn();
    renderWithMenu(<DiffView files={[FILE]} viewed={{ stateOf: () => 'stale', onToggle }} />);

    const box = within(headerOf()).getByRole('checkbox', { name: 'Viewed' });
    expect(box.matches(':checked')).toBe(false);
    fireEvent.mouseEnter(box.closest('label') ?? box);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByRole('tooltip').textContent).toBe('Changed since you viewed it');

    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith(FILE, true);
  });

  it('shows the whole file in place from its icon when the page gives no drawer', async () => {
    const loadFileSides = vi.fn(async () => ({
      old: 'a\nb\nc',
      new: 'a\nb\nc',
      isTooLarge: false,
    }));
    renderWithMenu(<DiffView files={[FILE]} loadFileSides={loadFileSides} />);

    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show whole file' }));

    await waitFor(() => expect(loadFileSides).toHaveBeenCalledWith(FILE));
  });

  it('hands the file to the page from the Show whole file icon', () => {
    const onShowWhole = vi.fn();
    renderWithMenu(
      <DiffView files={[FILE]} loadFileSides={vi.fn()} fileActions={{ onShowWhole }} />,
    );

    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show whole file' }));

    expect(onShowWhole).toHaveBeenCalledWith(FILE);
  });

  it('opens the file in the editor from its icon and has no Open in a drawer', () => {
    const onOpenInEditor = vi.fn();
    renderWithMenu(<DiffView files={[FILE]} fileActions={{ onOpenInEditor }} />);

    openFileMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open in editor' }));

    expect(onOpenInEditor).toHaveBeenCalledWith(FILE.path);
    expect(screen.queryByRole('button', { name: 'Open in a drawer' })).toBeNull();
  });

  it('keeps Copy path in the file menu', () => {
    renderWithMenu(<DiffView files={[FILE]} fileActions={{ onOpenInEditor: vi.fn() }} />);

    openFileMenu();

    expect(screen.getByRole('menuitem', { name: 'Copy path' })).toBeDefined();
  });

  it('offers no Viewed and no Comment on a read only change', () => {
    renderWithMenu(
      <DiffView
        files={[FILE]}
        comments={commentsWith([NOTE])}
        viewed={{ stateOf: () => 'none', onToggle: vi.fn() }}
        fileActions={{ onOpenInEditor: vi.fn() }}
        isReadOnly
      />,
    );

    expect(within(headerOf()).queryByRole('checkbox', { name: 'Viewed' })).toBeNull();
    expect(within(headerOf()).queryByRole('button', { name: /^Comment/ })).toBeNull();
    openFileMenu();
    expect(screen.getByRole('menuitem', { name: 'Copy path' })).toBeDefined();
  });
});

describe('landing on a thread', () => {
  it('scrolls the card of the thread into view once its file is open, and says it did', async () => {
    const onFocusHandled = vi.fn();
    const comments = commentsWith([NOTE, HOST]);
    const { rerender } = renderWithMenu(<DiffView files={[FILE]} comments={comments} />);

    rerender(
      <DiffView
        files={[FILE]}
        comments={comments}
        focusPath={FILE.path}
        focusThreadId="review:PRRT_1"
        onFocusHandled={onFocusHandled}
      />,
    );

    await waitFor(() => expect(onFocusHandled).toHaveBeenCalled());
    await waitFor(() => expect(document.activeElement).toBe(hostCard()));
    expect(vi.mocked(Element.prototype.scrollIntoView)).toHaveBeenCalledWith({ block: 'center' });
  });

  it('opens a file the reader had closed to land on the thread inside it', async () => {
    const comments = commentsWith([NOTE]);
    const viewed = { stateOf: () => 'viewed' as const, onToggle: vi.fn() };
    const { rerender } = renderWithMenu(
      <DiffView files={[FILE]} comments={comments} viewed={viewed} />,
    );
    expect(screen.queryByRole('article', { name: /^Note from You/ })).toBeNull();

    rerender(
      <DiffView
        files={[FILE]}
        comments={comments}
        viewed={viewed}
        focusPath={FILE.path}
        focusThreadId="note-1"
        onFocusHandled={vi.fn()}
      />,
    );

    await waitFor(() => expect(document.activeElement).toBe(noteCard()));
  });
});
