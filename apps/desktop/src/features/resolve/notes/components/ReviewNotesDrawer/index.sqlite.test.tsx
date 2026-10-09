// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  startNoteFix: vi.fn(async (_params: unknown) => ({
    batchId: 'notes-batch',
    launchId: 'notes-launch',
    agentId: 'notes-agent',
  })),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../startNoteFix', () => ({ startNoteFix: h.startNoteFix }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { IsoDateTime, PrReviewDraft, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { UndoToastBridge } from '../../../../../app/components/UndoToastBridge';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { noteThreadId } from '../../noteThread';
import { ReviewNotesDrawer } from '.';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const SESSION = 'session-ledger-export' as SessionId;
const STAMP = '2026-10-05T08:00:00.000Z' as IsoDateTime;

const PULL_REQUEST = {
  id: 'task-318',
  sessionId: SESSION,
  provider: 'github' as const,
  externalId: '318',
  identifier: '#318',
  url: 'https://github.com/harborline/ledger-core/pull/318',
  title: 'Ledger export',
  createdAt: STAMP,
};

const FILE_DRAFT: PrReviewDraft = {
  id: 'draft-file',
  sessionId: SESSION,
  provider: 'github',
  repo: 'harborline/ledger-core',
  prNumber: 318,
  path: 'src/ledger/postings.ts',
  line: 0,
  startLine: null,
  side: 'new',
  body: 'Split this file',
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: STAMP,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.startNoteFix.mockClear();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertSession(db, aSession({ id: SESSION, workspaceId: WORKSPACE_ID }));
  const { addDiffComment } = useAppStore.getState();
  await addDiffComment(SESSION, 'src/ledger/postings.ts', 'Cast the ledger id', {
    side: 'new',
    lineNumber: 42,
  });
  await addDiffComment(SESSION, 'src/ledger/postings.ts', 'Log the duplicate once', {
    side: 'new',
    lineNumber: 57,
  });
  await addDiffComment(SESSION, 'src/ledger/export.ts', 'Rename PAGE_SIZE');
});

afterEach(cleanup);

const renderDrawer = ({ onClose = vi.fn() }: { readonly onClose?: () => void } = {}) =>
  render(
    <ToastProvider>
      <UndoToastBridge />
      <ReviewNotesDrawer
        sessionId={SESSION}
        mountPath={null}
        focusPath={null}
        focusThreadId={null}
        onClose={onClose}
      />
    </ToastProvider>,
  );

const drawer = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Your notes' });

const openMenu = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More note actions' }));
  });
};

describe('the review notes drawer on sqlite', () => {
  it('groups the open notes by file under Your notes with the count', async () => {
    renderDrawer();

    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));
    const postings = within(panel).getByRole('region', { name: 'src/ledger/postings.ts' });
    const exported = within(panel).getByRole('region', { name: 'src/ledger/export.ts' });
    expect(within(postings).getAllByText('Open note')).toHaveLength(2);
    expect(within(exported).getAllByText('Open note')).toHaveLength(1);
    expect(within(panel).getAllByRole('button', { name: 'Close' })).toHaveLength(4);
    expect(within(panel).getAllByRole('button', { name: 'Delete' })).toHaveLength(3);
  });

  it('keeps the key hint of Fix on a note in the muted tone, as the button is not filled', async () => {
    renderDrawer();

    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));
    const fixes = panel.querySelectorAll<HTMLElement>('[data-review-verb="reviewComment.draft"]');
    expect(fixes).toHaveLength(3);
    fixes.forEach((fix) => {
      const hint = fix.querySelector('kbd');
      expect(hint).not.toBeNull();
      expect(hint?.className).not.toContain('text-on-tone');
    });
  });

  it('closes a note with Close, lists it under Show closed and reopens it', async () => {
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));

    await act(async () => {
      fireEvent.click(within(panel).getAllByRole('button', { name: 'Close' })[1]!);
    });

    await waitFor(() => within(panel).getByText('2 open'));
    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Show closed' }));
    });
    const closed = within(panel).getByRole('region', { name: 'Closed' });
    await act(async () => {
      fireEvent.click(within(closed).getByRole('button', { name: 'Reopen' }));
    });

    await waitFor(() => within(panel).getByText('3 open'));
  });

  it('deletes a note with Delete and Undo brings the same note back', async () => {
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));
    const before = await rowsOf<{ id: string }>({
      sql: 'SELECT id FROM diff_comments ORDER BY id',
    });

    await act(async () => {
      fireEvent.click(within(panel).getAllByRole('button', { name: 'Delete' })[0]!);
    });

    await waitFor(() => within(panel).getByText('2 open'));
    screen.getByText('Note discarded');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    await waitFor(() => within(panel).getByText('3 open'));
    expect(
      await rowsOf<{ id: string }>({ sql: 'SELECT id FROM diff_comments ORDER BY id' }),
    ).toEqual(before);
  });

  it('starts one fix run on every open note with Fix 3', async () => {
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));

    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Fix 3' }));
    });

    expect(h.startNoteFix).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Follow' });
    const [params] = h.startNoteFix.mock.calls[0] ?? [];
    expect(params).toMatchObject({ sessionId: SESSION });
    const ids = (params as { readonly threadIds: ReadonlyArray<string> }).threadIds;
    expect(ids).toHaveLength(3);
    expect(ids.every((id) => id.startsWith(noteThreadId({ noteId: '' })))).toBe(true);
  });

  it('leaves a note out of Fix N when its checkbox is cleared', async () => {
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));

    await act(async () => {
      fireEvent.click(within(panel).getAllByRole('checkbox', { name: 'Include in the fix' })[0]!);
    });

    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Fix 2' }));
    });
    const [params] = h.startNoteFix.mock.calls[0] ?? [];
    expect((params as { readonly threadIds: ReadonlyArray<string> }).threadIds).toHaveLength(2);
  });

  it('jumps to the file of a note on the Files tab and keeps the drawer open', async () => {
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));
    const exported = within(panel).getByRole('region', { name: 'src/ledger/export.ts' });

    await act(async () => {
      fireEvent.click(within(exported).getByRole('button', { name: 'Jump to file' }));
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    const [request] = navigate.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      to: {
        view: { target: { tab: 'files', focus: { kind: 'branch', path: 'src/ledger/export.ts' } } },
      },
      drawer: { kind: 'review-notes', sessionId: SESSION },
    });
  });

  it('offers Move N to review draft only when a pull request is open', async () => {
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));

    await openMenu();
    expect(screen.queryByRole('menuitem', { name: /to review draft/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Show closed' })).toBeDefined();
  });

  it('moves every open note to the review draft when a pull request is open', async () => {
    useAppStore.setState({
      sessionExternalTasks: { [SESSION]: [PULL_REQUEST] },
      sessionGithub: {
        [SESSION]: {
          pr: {
            number: 318,
            title: 'Ledger export',
            url: PULL_REQUEST.url,
            state: 'open',
            mergeable: true,
            checks: 'success',
            baseBranch: 'main',
            headBranch: 'hl/ledger-export',
            isDraft: false,
            reviewDecision: null,
            body: '',
            updatedAt: STAMP,
          },
          linkedIssues: [],
          fetchedAt: null,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
        },
      },
    });
    renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));

    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Move 3 to review draft' }));
    });

    await waitFor(() => within(panel).getByText('0 open'));
    const drafts = await rowsOf<{ path: string; line: number }>({
      sql: 'SELECT path, line FROM pr_review_drafts ORDER BY path, line',
    });
    expect(drafts).toEqual([
      { path: 'src/ledger/export.ts', line: 0 },
      { path: 'src/ledger/postings.ts', line: 42 },
      { path: 'src/ledger/postings.ts', line: 57 },
    ]);
  });

  it('shows the older drafts line only while file-level drafts exist and a pull request is open', async () => {
    const setPullRequestMode = vi.fn();
    useAppStore.setState({ reviewDrafts: { [SESSION]: [FILE_DRAFT] }, setPullRequestMode });
    const view = renderDrawer();
    const panel = await drawer();
    await waitFor(() => within(panel).getByText('3 open'));
    expect(within(panel).queryByText('1 older draft is in your review draft')).toBeNull();

    act(() => {
      useAppStore.setState({ sessionExternalTasks: { [SESSION]: [PULL_REQUEST] } });
    });

    within(panel).getByText('1 older draft is in your review draft');
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Open review draft' }));
    });
    expect(setPullRequestMode).toHaveBeenCalledWith({ sessionId: SESSION, mode: 'write_review' });
    view.unmount();
  });
});
