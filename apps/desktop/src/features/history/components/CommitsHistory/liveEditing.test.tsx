// @vitest-environment happy-dom

import { insertWorkspace, insertSession } from '@goodboy/db';
import { buildStoryWorkspace, storySqlite } from '../../../../store/storyHarness';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { HistoryLiveOutcome } from '../../historyLiveTypes';
import { seedLiveHistory } from '../../testing/seedLiveHistory';
import { LEDGER, LEDGER_COMMITS, LEDGER_GRAPH } from '../../testing/ledgerFixture';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../store/slices/worktreeStatuses/cache';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { CommitsHistory } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

let store: Awaited<ReturnType<typeof importStore>>;
let fixture: ReturnType<typeof seedLiveHistory>;
let outcome: HistoryLiveOutcome;
let head: string = LEDGER.f;
let commits = LEDGER_COMMITS;
const requests: unknown[] = [];
let backups: ReadonlyArray<unknown> = [];

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  resetWorktreeStatusCache();
  installFakeResizeObserver();
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mac OS X');
  fixture = seedLiveHistory({ store });
  const session = store.getState().sessions[0];
  if (session === undefined || session.workspaceId === null) {
    throw new Error('The live edit fixture needs its workspace.');
  }
  await insertWorkspace({
    db: storySqlite(),
    workspace: buildStoryWorkspace({ id: session.workspaceId, name: 'Harborline' }),
  });
  await insertSession(storySqlite(), session);
  head = LEDGER.f;
  commits = LEDGER_COMMITS;
  requests.length = 0;
  backups = [];
  outcome = {
    kind: 'finished',
    outcome: { kind: 'moved', head: 'new-head', backupRef: 'backup-old', carriedCount: 0 },
    map: [],
  };
  stubStoryInvoke({
    worktree_commits: () => commits,
    worktree_status: () => ({
      branch: fixture.mount.branch,
      head,
      headSubject: commits[0]?.subject ?? null,
      upstream: 'origin/hl/ledger-export',
      upstreamDistance: { kind: 'known', ahead: 1, behind: 1 },
      mainDistance: { kind: 'known', ahead: 7, behind: 15 },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    }),
    history_graph: () => LEDGER_GRAPH,
    history_plan_predict: () => ({
      isSupported: true,
      head,
      steps: [],
      isTreeEqual: true,
      changedFiles: [],
    }),
    history_live_edit: (args: unknown) => {
      requests.push(args);
      if (outcome.kind === 'finished' && outcome.outcome.kind === 'moved') {
        head = outcome.outcome.head;
        commits = LEDGER_COMMITS.map((commit, index) =>
          index === 0 ? { ...commit, sha: head, subject: 'Acme export' } : commit,
        );
      }
      return outcome;
    },
    history_restore: (args: unknown) => {
      requests.push(args);
      head = head === 'new-head' ? LEDGER.f : 'new-head';
      commits = LEDGER_COMMITS.map((commit, index) =>
        index === 0
          ? { ...commit, sha: head, subject: head === 'new-head' ? 'Acme export' : commit.subject }
          : commit,
      );
      return { kind: 'moved', head, backupRef: `backup-${head}`, carriedCount: 0 };
    },
    history_backups_list: () => backups,
    worktree_list_branch_names: () => ['main', 'release/2.4'],
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type MountParams = { readonly isReadOnly?: boolean };
const mountPage = async ({ isReadOnly = false }: MountParams = {}) => {
  const view = render(
    <CommitsHistory
      sessionId={fixture.input.sessionId}
      worktreePath={fixture.mount.worktreePath}
      isReadOnly={isReadOnly}
    />,
  );
  await screen.findByRole('list', { name: 'Commits' });
  return view;
};
const topRow = () => screen.getByRole('listitem', { name: 'Fix typo in CSV header' });
const rename = async () => {
  fireEvent.keyDown(topRow(), { key: 'r' });
  const editor = screen.getByRole('textbox', { name: 'Commit subject' });
  fireEvent.change(editor, { target: { value: 'Acme export' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save message' }));
  await screen.findByRole('listitem', { name: 'Acme export' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Undo commit edit' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
};

describe('live Commits page', () => {
  it('shows the branch graph and no preview or staged apply controls', async () => {
    await mountPage();
    expect(screen.getByRole('list', { name: 'Commits' }).children.length).toBe(7);
    expect(screen.queryByRole('heading', { name: /After Apply|Planned changes/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Apply|Reset all/ })).toBeNull();
    screen.getByText('Based on main');
    expect(screen.queryByRole('button', { name: 'Rebase onto latest' })).toBeNull();
  });
  it('hides Undo and Redo until there is an edit to take back', async () => {
    await mountPage();
    expect(screen.queryByRole('button', { name: 'Undo commit edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Redo commit edit' })).toBeNull();
  });
  it('renames immediately and updates the commit accessible name', async () => {
    await mountPage();
    await rename();
    expect(screen.queryByRole('listitem', { name: 'Fix typo in CSV header' })).toBeNull();
    expect(requests[0]).toMatchObject({
      args: {
        request: {
          branch: fixture.mount.branch,
          plan: {
            steps: expect.arrayContaining([
              expect.objectContaining({ verb: 'reword', message: 'Acme export' }),
            ]),
          },
        },
      },
    });
  });
  it('undoes and redoes from the header', async () => {
    await mountPage();
    await rename();
    fireEvent.click(screen.getByRole('button', { name: 'Undo commit edit' }));
    await screen.findByRole('listitem', { name: 'Fix typo in CSV header' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Redo commit edit' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Redo commit edit' }));
    await screen.findByRole('listitem', { name: 'Acme export' });
    expect(requests).toHaveLength(3);
  });
  it('undoes and redoes with Command Z and Shift Command Z', async () => {
    await mountPage();
    await rename();
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', metaKey: true });
    await screen.findByRole('listitem', { name: 'Fix typo in CSV header' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Redo commit edit' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.keyDown(window, { key: 'Z', code: 'KeyZ', metaKey: true, shiftKey: true });
    await screen.findByRole('listitem', { name: 'Acme export' });
  });
  it('announces nothing to undo and sends nothing on a fresh page', async () => {
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'z', code: 'KeyZ', metaKey: true });
    await screen.findByText('Nothing to undo');
    fireEvent.keyDown(topRow(), { key: 'Z', code: 'KeyZ', metaKey: true, shiftKey: true });
    await screen.findByText('Nothing to redo');
    expect(screen.queryByText('Undone')).toBeNull();
    expect(screen.queryByText('Redone')).toBeNull();
    expect(requests).toHaveLength(0);
  });
  it('leaves native text-field undo alone', async () => {
    await mountPage();
    await rename();
    fireEvent.keyDown(screen.getByRole('listitem', { name: 'Acme export' }), { key: 'r' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Commit subject' }), {
      key: 'z',
      code: 'KeyZ',
      metaKey: true,
    });
    expect(requests).toHaveLength(1);
  });
  it('folds a focused commit with C immediately', async () => {
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'c' });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      args: {
        request: {
          plan: {
            steps: expect.arrayContaining([
              expect.objectContaining({ sha: LEDGER.f, verb: 'fixup' }),
            ]),
          },
        },
      },
    });
  });
  it('combines both messages with S immediately', async () => {
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 's' });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      args: {
        request: {
          plan: {
            steps: expect.arrayContaining([
              expect.objectContaining({ sha: LEDGER.f, verb: 'squash' }),
            ]),
          },
        },
      },
    });
  });
  it('drops a commit with Delete immediately', async () => {
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      args: {
        request: {
          plan: {
            steps: expect.arrayContaining([
              expect.objectContaining({ sha: LEDGER.f, verb: 'drop' }),
            ]),
          },
        },
      },
    });
  });
  it('reorders with Alt and the arrows immediately', async () => {
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      args: {
        request: {
          plan: {
            steps: expect.arrayContaining([
              expect.objectContaining({ sha: LEDGER.f, verb: 'pick' }),
            ]),
          },
        },
      },
    });
  });
  it('moves focus between commits without editing with plain arrows', async () => {
    await mountPage();
    topRow().focus();
    fireEvent.keyDown(topRow(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: 'wip export tests' }));
    expect(requests).toEqual([]);
  });
  it('offers the row actions and a menu with at least two rows', async () => {
    await mountPage();
    fireEvent.click(within(topRow()).getByRole('button', { name: /More/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Rename/ })).toBeDefined();
    expect(within(menu).getByRole('menuitem', { name: /Remove/ })).toBeDefined();
  });
  it('opens the key hints beside their trigger', async () => {
    await mountPage();
    fireEvent.click(screen.getByRole('button', { name: 'Keys' }));
    screen.getByText('Move the commit');
    screen.getByText('Rename');
  });
  it('blocks inline while an agent owns the writer reservation', async () => {
    outcome = { kind: 'blocked', reason: 'Acme agent is writing here' };
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    within(await screen.findByRole('alert')).getByText('Acme agent is writing here');
    expect(screen.queryByRole('button', { name: 'Undo commit edit' })).toBeNull();
    screen.getByRole('button', { name: 'Retry' });
  });
  it('offers stash consent without changing the displayed branch', async () => {
    outcome = {
      kind: 'finished',
      outcome: { kind: 'needs-stash', dirtyCount: 1, files: ['export.ts'] },
      map: [],
    };
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    await screen.findByRole('button', { name: 'Stash and continue' });
    topRow();
    expect(screen.queryByRole('button', { name: 'Undo commit edit' })).toBeNull();
  });
  it('shows a conflicting edit with the Rewriter offer and Undo', async () => {
    outcome = {
      kind: 'stopped',
      result: {
        head: null,
        map: [],
        isTreeEqual: false,
        changedFiles: [],
        stop: {
          sha: LEDGER.f,
          index: 0,
          kind: 'merge',
          files: ['export.ts'],
          message: 'export.ts conflicts',
        },
        copyPath: null,
        order: [],
        check: null,
      },
    };
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    await screen.findByRole('button', { name: 'Rewrite with an agent' });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('alert')).toBeNull();
    topRow();
  });
  it('hands the hint to the Rewriter and clears it once the first turn is accepted', async () => {
    outcome = {
      kind: 'stopped',
      result: {
        head: null,
        map: [],
        isTreeEqual: false,
        changedFiles: [],
        stop: {
          sha: LEDGER.f,
          index: 0,
          kind: 'merge',
          files: ['export.ts'],
          message: 'export.ts conflicts',
        },
        copyPath: null,
        order: [],
        check: null,
      },
    };
    const startHistoryRewriter = vi.fn(async (params: { readonly onAccepted?: () => void }) => {
      params.onAccepted?.();
      return 'rewriting' as const;
    });
    store.setState({ startHistoryRewriter });
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    await screen.findByRole('button', { name: 'Rewrite with an agent' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hint for the agent' }), {
      target: { value: '  Keep the retry loop.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite with an agent' }));
    await waitFor(() => expect(startHistoryRewriter).toHaveBeenCalledTimes(1));
    expect(startHistoryRewriter.mock.calls[0]?.[0]).toMatchObject({ note: 'Keep the retry loop.' });
    const scope = START_HINT_SCOPES.rebase({ mountId: fixture.input.mountId });
    await waitFor(() =>
      expect(store.getState().startHints[fixture.input.sessionId]?.[scope]).toBeUndefined(),
    );
  });
  it('keeps the hint when the Rewriter does not accept the first turn', async () => {
    outcome = {
      kind: 'stopped',
      result: {
        head: null,
        map: [],
        isTreeEqual: false,
        changedFiles: [],
        stop: {
          sha: LEDGER.f,
          index: 0,
          kind: 'merge',
          files: ['export.ts'],
          message: 'export.ts conflicts',
        },
        copyPath: null,
        order: [],
        check: null,
      },
    };
    const startHistoryRewriter = vi.fn(async () => 'stopped' as const);
    store.setState({ startHistoryRewriter });
    await mountPage();
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    await screen.findByRole('button', { name: 'Rewrite with an agent' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hint for the agent' }), {
      target: { value: 'Keep the retry loop.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite with an agent' }));
    await waitFor(() => expect(startHistoryRewriter).toHaveBeenCalledTimes(1));
    const scope = START_HINT_SCOPES.rebase({ mountId: fixture.input.mountId });
    expect(store.getState().startHints[fixture.input.sessionId]?.[scope]?.text).toBe(
      'Keep the retry loop.',
    );
  });
  it('shows busy on the edited row and ignores new edits', async () => {
    let release: (result: HistoryLiveOutcome) => void = () => undefined;
    await mountPage();
    stubStoryInvoke({
      history_plan_predict: () => ({
        isSupported: true,
        head,
        steps: [],
        isTreeEqual: true,
        changedFiles: [],
      }),
      history_live_edit: (args: unknown) => {
        requests.push(args);
        return new Promise<HistoryLiveOutcome>((resolve) => {
          release = resolve;
        });
      },
    });
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    expect(topRow().getAttribute('aria-busy')).toBe('true');
    fireEvent.keyDown(topRow(), { key: 'c' });
    expect(requests).toHaveLength(1);
    await act(async () => release({ kind: 'blocked', reason: 'Acme agent is writing here' }));
  });
  it('clears the page stack on unmount and keeps the refreshed branch on reopening', async () => {
    const page = await mountPage();
    await rename();
    page.unmount();
    expect(store.getState().historyLiveSessions[fixture.input.mountId]).toBeUndefined();
    await mountPage();
    screen.getByRole('listitem', { name: 'Acme export' });
    expect(screen.queryByRole('button', { name: 'Undo commit edit' })).toBeNull();
  });
  it('renders merged branches read-only', async () => {
    await mountPage({ isReadOnly: true });
    fireEvent.keyDown(topRow(), { key: 'Delete' });
    expect(requests).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Undo commit edit' })).toBeNull();
    expect(within(topRow()).queryByRole('button', { name: 'Rename' })).toBeNull();
  });
  it('keeps Backups out of the header and opens previous versions under the graph', async () => {
    backups = [
      {
        refName: 'refs/goodboy/backup/x',
        sha: LEDGER.a,
        subject: 'Add ledger export',
        createdAt: 1,
        isLegacy: false,
      },
    ];
    await mountPage();
    expect(screen.queryByRole('button', { name: 'Backups' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Previous versions 1' }));
    expect(store.getState().drawer).toMatchObject({ kind: 'history-versions' });
  });
});
