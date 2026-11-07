// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { LEFT_SIDEBAR_MAX } from '@goodboy/ui';
import type {
  BranchCommit,
  DiffComment,
  HistoryGraph,
  MountId,
  ProjectId,
  PullRequestState,
  SessionProjectMount,
} from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sceneClock } from '../../../../app/components/MockScene/sceneClock';
import { branchPlace } from '../../../../store/slices/navigation/place';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  NOTE_IDS,
  resolveNotesFor,
} from '../../../../app/components/MockScene/scenes/resolveNotesSeed';
import { railOf, sectionNames } from '../../../../test/branchRail';
import { BranchPage } from './index';
import { DrawerHost } from '../../../../app/components/DrawerHost';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({
  threadId = null,
}: { readonly threadId?: string | null } = {}): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const clock = sceneClock({ anchor: '2026-10-09T10:00:00.000Z' });

const PROJECT_ID = 'project-payments-api' as ProjectId;
const MOUNT_ID = 'mount-payments-api' as MountId;
const WORKTREE = '/w/payments-api';

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION.id,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repo/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const PATCH = [
  'diff --git a/src/credit.ts b/src/credit.ts',
  'index 1111111..2222222 100644',
  '--- a/src/credit.ts',
  '+++ b/src/credit.ts',
  '@@ -1,1 +1,2 @@',
  ' export const credit = 1;',
  '+export const dedupe = true;',
  'diff --git a/src/webhook.ts b/src/webhook.ts',
  'index 3333333..4444444 100644',
  '--- a/src/webhook.ts',
  '+++ b/src/webhook.ts',
  '@@ -1,1 +1,2 @@',
  ' export const webhook = 1;',
  '+export const retry = 3;',
  '',
].join('\n');

const COMMITS: ReadonlyArray<BranchCommit> = [1, 2, 3].map((index) => ({
  sha: `a${index}`.padEnd(40, '0'),
  shortSha: `a${index}00000`,
  subject: `Commit ${index}`,
  author: 'dana-r',
  timestamp: 1,
  pushed: false,
  parentSha: null,
}));

const seedWorktree = ({ isDiffLoaded }: { readonly isDiffLoaded: boolean }): void => {
  vi.mocked(invoke).mockImplementation(async (command: string) =>
    command === 'worktree_diff' && isDiffLoaded ? PATCH : new Promise<never>(() => undefined),
  );
  useAppStore.setState((state) => ({
    projects: [
      aProject({
        id: PROJECT_ID,
        workspaceId: SESSION.workspaceId,
        name: 'payments-api',
        baseBranch: 'main',
      }),
    ],
    sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION.id]: [MOUNT] },
    sessionActiveMount: { ...state.sessionActiveMount, [SESSION.id]: MOUNT_ID },
  }));
};

const seedShownPullRequest = (): void => {
  useAppStore.setState((state) => {
    const github = state.sessionGithub[SESSION.id];
    if (github === undefined || github.pr === null) {
      return state;
    }
    return {
      mountGithub: {
        ...state.mountGithub,
        [MOUNT_ID]: {
          ...github,
          mountId: MOUNT_ID,
          projectId: PROJECT_ID,
          revision: 1,
          repository: null,
          host: null,
          branch: MOUNT.branch,
          prs: [github.pr],
          links: [],
        },
      },
    };
  });
};

const graphWithRemote = ({ remoteSha }: { readonly remoteSha: string }): HistoryGraph => ({
  baseRef: 'origin/main',
  mergeBase: { sha: 'b'.repeat(40), subject: 'Base', author: 'dana-r', timestamp: 1 },
  mainHead: 'b'.repeat(40),
  mainCommits: [],
  behind: 0,
  remoteSha,
  files: [],
});

const withCommits = ({ remoteSha = null }: { readonly remoteSha?: string | null } = {}): void => {
  useAppStore.setState((state) => ({
    historyDrafts: {
      ...state.historyDrafts,
      [MOUNT_ID]: {
        sessionId: SESSION.id,
        mountId: MOUNT_ID,
        planId: 'plan-1',
        branch: MOUNT.branch,
        baseSha: 'b'.repeat(40),
        headSha: COMMITS[0]?.sha ?? '',
        commits: COMMITS,
        items: [],
        onto: null,
        graph: remoteSha === null ? null : graphWithRemote({ remoteSha }),
        undo: [],
        prediction: null,
        isPredicting: false,
        loadError: null,
      },
    },
  }));
};

const depthOf = (): number => {
  const state = useAppStore.getState();
  return state.navigation[state.currentWorkspaceId ?? '']?.entries.length ?? 0;
};

const headerColumnElement = (): HTMLElement => {
  const column = document
    .querySelector('[data-slot="pane-header"]')
    ?.closest<HTMLElement>('[data-page-column]');
  if (column === null || column === undefined) {
    throw new Error('the page has no header column');
  }
  return column;
};

const railRow = (name: RegExp): HTMLElement => within(railOf()).getByRole('tab', { name });

const visit = async (name: RegExp): Promise<void> => {
  fireEvent.click(railRow(name));
  await settle();
};

const patchRequest = (patch: Partial<PullRequestState>): void => {
  act(() => {
    useAppStore.setState((state) => {
      const current = state.sessionGithub[SESSION.id];
      if (current === undefined || current.pr === null) {
        return state;
      }
      return {
        sessionGithub: {
          ...state.sessionGithub,
          [SESSION.id]: { ...current, pr: { ...current.pr, ...patch } },
        },
      };
    });
  });
};

const dropRequest = (): void => {
  act(() => {
    seedWorktree({ isDiffLoaded: false });
    useAppStore.setState((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [SESSION.id]: { ...state.sessionGithub[SESSION.id]!, pr: null },
      },
      sessionSelectedPrNumber: { ...state.sessionSelectedPrNumber, [SESSION.id]: null },
      sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [SESSION.id]: [] },
    }));
  });
};

const aNote = (): DiffComment => ({
  id: 'note-1',
  sessionId: SESSION.id,
  filePath: 'src/ledger/postCredit.ts',
  body: 'Guard the retry.',
  status: 'open',
  createdAt: clock.iso({ at: '2026-10-09T10:00:00.000Z' }),
  authorKind: 'user',
  projectId: PROJECT_ID,
  branch: MOUNT.branch,
});

describe('Branch page header and sections', () => {
  it('names the pull request and lists Overview, Comments, Changes, Commits and Checks in the rail', async () => {
    await mount();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      useAppStore.getState().sessionGithub[SESSION.id]?.pr?.title,
    );
    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Changes', 'Commits', 'Checks']);
    expect(railRow(/^Comments/).getAttribute('aria-selected')).toBe('true');
  });

  it('draws the five sections as a tab strip under the title, each count the one the rail row reads', async () => {
    await mount();

    const strip = screen.getByRole('tablist', { name: 'Branch pages' });
    const tabs = within(strip).getAllByRole('tab');
    expect(tabs.map((tab) => (tab.textContent ?? '').replace(/[^A-Za-z ]/g, '').trim())).toEqual([
      'Pull request',
      'Comments',
      'Changes',
      'Commits',
      'Checks',
    ]);
    expect(
      within(strip)
        .getByRole('tab', { name: /^Comments/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    for (const name of [/^Comments/, /^Changes/, /^Commits/, /^Checks/]) {
      const count = (text: string | null): string => (text ?? '').replace(/^[A-Za-z ]+/, '').trim();
      expect(count(within(strip).getByRole('tab', { name }).textContent)).toBe(
        count(railRow(name).textContent),
      );
    }
  });

  it('carries one primary at most and none of the controls of the neighbouring pages', async () => {
    await mount();

    expect(document.querySelectorAll('[data-branch-primary]').length).toBeLessThanOrEqual(1);
    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /^(Edit commits|Open in Review|PR #\d+)/.test(name))).toEqual([]);
  });

  it('switches sections in the address without adding history', async () => {
    await mount();
    useAppStore
      .getState()
      .navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'comments' }) });
    const depth = depthOf();

    await visit(/^Checks/);

    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('checks');
    expect(depthOf()).toBe(depth);
    expect(railRow(/^Checks/).getAttribute('aria-selected')).toBe('true');
    expect(railRow(/^Comments/).getAttribute('aria-current')).toBeNull();
  });
});

describe('Branch page sections by state', () => {
  it('keeps Overview, Changes and Commits with no pull request and no comment, and no Checks', async () => {
    await mount();
    dropRequest();
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Changes', 'Commits']);
  });

  it('adds Comments to a branch with no pull request once one local note exists', async () => {
    await mount();
    dropRequest();
    act(() => {
      useAppStore.setState({ diffComments: { [SESSION.id]: [aNote()] } });
    });
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Changes', 'Commits']);
    expect(railRow(/^Comments/).textContent).toBe('Comments');
  });

  it.each(['draft', 'open', 'merged', 'closed', 'queued'] as const)(
    'lists all five sections for a %s pull request',
    async (state) => {
      await mount();
      patchRequest({ state, isDraft: state === 'draft' });
      await settle();

      expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Changes', 'Commits', 'Checks']);
    },
  );

  it('falls back to Changes when the section in the address does not exist in the state', async () => {
    await mount();
    dropRequest();
    act(() => {
      useAppStore.setState({ branchTab: { [SESSION.id]: 'comments' } });
    });
    await settle();

    expect(railRow(/^Changes/).getAttribute('aria-selected')).toBe('true');
  });

  it('puts no primary in the header of a merged pull request and says its state once, under the title', async () => {
    await mount();
    patchRequest({ state: 'merged', isDraft: false });
    await visit(/^Pull request/);

    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    const states = document.querySelectorAll('[data-slot="branch-state"]');
    expect(states).toHaveLength(1);
    expect(states[0]?.closest('[data-pr-header-line]')).not.toBeNull();
    expect(states[0]?.getAttribute('data-tone')).toBe('merged');
    expect(document.querySelector('[data-cell="merge"]')?.textContent).toContain('Merged');
  });

  it('shows the queue in the Merge cell of a queued pull request and no primary', async () => {
    await mount();
    patchRequest({ state: 'queued', isDraft: false, mergeQueue: { position: 3 } });
    await visit(/^Pull request/);

    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    const merge = document.querySelector('[data-cell="merge"]');
    expect(merge?.textContent).toContain('Queued');
    expect(merge?.textContent).toContain('Queued to merge, 3rd in line');
  });

  it('shows no Rebase and no Apply in the Commits of a merged pull request', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();
    await visit(/^Commits/);
    patchRequest({ state: 'merged', isDraft: false });
    await settle();

    expect(screen.queryByRole('button', { name: /Rebase on/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Apply/ })).toBeNull();
    expect(screen.getByText('Commit 1')).toBeDefined();
  });
});

let observers: FakeResizeObservers | null = null;

const mountAt = async ({
  width,
  threadId = null,
}: {
  readonly width: number;
  readonly threadId?: string | null;
}): Promise<void> => {
  observers = installFakeResizeObserver();
  await mount({ threadId });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, width, 600),
  );
  act(() => observers?.resizeAll());
  await settle();
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  observers = null;
});

const bodyColumnWidths = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll('[data-slot="pane-body"] [data-page-column]'))
    .filter((column) => column.parentElement?.closest('[data-page-column]') === null)
    .map((column) => column.getAttribute('data-width'));

const headerColumn = (): string | null =>
  document
    .querySelector('[data-slot="pane-header"]')
    ?.closest('[data-page-column]')
    ?.getAttribute('data-width') ?? null;

describe('Branch page column', () => {
  it('keeps the header and the body of Comments, Changes and Commits on the column at every section', async () => {
    await mount();

    for (const name of [/^Comments/, /^Changes/, /^Commits/]) {
      await visit(name);

      expect(headerColumn()).toBe('column');
      expect(bodyColumnWidths().length).toBeGreaterThan(0);
      expect(bodyColumnWidths().every((width) => width === 'column')).toBe(true);
    }
  });

  it('keeps the diff and the commit graph on the column once the session has a worktree', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    for (const name of [/^Comments/, /^Changes/, /^Commits/]) {
      await visit(name);

      expect(headerColumn()).toBe('column');
      expect(bodyColumnWidths().length).toBeGreaterThan(0);
      expect(bodyColumnWidths().every((width) => width === 'column')).toBe(true);
    }
  });

  it('keeps one h1 on one column element from Overview through every section and back', async () => {
    await mount();
    const column = headerColumnElement();
    const title = screen.getByRole('heading', { level: 1 });

    for (const name of [
      /^Pull request/,
      /^Comments/,
      /^Changes/,
      /^Commits/,
      /^Checks/,
      /^Changes/,
      /^Pull request/,
    ]) {
      await visit(name);

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toBe(title);
      expect(
        document.querySelector('[data-slot="pane-header"]')?.closest('[data-page-column]'),
      ).toBe(column);
      expect(column.getAttribute('data-width')).toBe('column');
    }
  });
});

describe('Branch page counts', () => {
  const countOf = (name: RegExp): string =>
    railRow(name).textContent?.replace(/^[A-Za-z]+/, '') ?? '';

  it('shows nothing while a count is unknown, never a dash or a 0', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: false });
    act(() => {
      useAppStore.setState((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [SESSION.id]: { ...state.sessionGithub[SESSION.id]!, detail: null },
        },
      }));
      seedShownPullRequest();
    });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    for (const name of [/^Changes/, /^Commits/, /^Checks/]) {
      const row = railRow(name);
      expect(row.querySelector('[data-entry-slot]')).toBeNull();
      expect(row.textContent).not.toMatch(/[0-]/);
    }
  });

  it('draws the file, commit and comment counts on their tabs', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits({ remoteSha: 'c'.repeat(40) });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(Number(countOf(/^Changes/).split(/\s/)[0])).toBeGreaterThan(0);
    expect(countOf(/^Commits/)).not.toBe('');
    expect(Number(countOf(/^Comments/))).toBeGreaterThan(0);
  });
});

describe('Branch page counts before any visit', () => {
  const countOf = (name: RegExp): string =>
    railRow(name).textContent?.replace(/^[A-Za-z]+/, '') ?? '';

  it('loads the commit history once when the page opens, and counts every tab without a visit', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    const loadHistoryDraft = vi.fn(async () => {
      withCommits({ remoteSha: 'c'.repeat(40) });
    });
    useAppStore.setState({ loadHistoryDraft });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(loadHistoryDraft).toHaveBeenCalledTimes(1);
    expect(loadHistoryDraft).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT_ID });
    expect(railRow(/^Comments/).getAttribute('aria-selected')).toBe('true');
    expect(Number(countOf(/^Changes/).split(/\s/)[0])).toBeGreaterThan(0);
    expect(countOf(/^Commits/)).not.toBe('');
    expect(Number(countOf(/^Comments/))).toBeGreaterThan(0);
  });

  it('does not load the history again when the draft is already there', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits({ remoteSha: 'c'.repeat(40) });
    const loadHistoryDraft = vi.fn(async () => undefined);
    useAppStore.setState({ loadHistoryDraft });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(loadHistoryDraft).not.toHaveBeenCalled();
    expect(countOf(/^Commits/)).not.toBe('');
  });
});

describe('Branch page Comments', () => {
  it('opens a thread by putting it in the address, and the Branch crumb leads back to the list', async () => {
    await mountAt({ width: 1100 });

    fireEvent.click(
      screen
        .getByRole('navigation', { name: 'Comments' })
        .querySelector('[data-thread-id]') as HTMLElement,
    );
    await settle();
    expect(useAppStore.getState().branchThreadId[SESSION.id]).not.toBeNull();

    act(() => {
      useAppStore
        .getState()
        .navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'comments' }) });
    });
    await settle();
    expect(useAppStore.getState().branchThreadId[SESSION.id] ?? null).toBeNull();
  });

  it('keeps the selected thread on the list after the list is shown again', async () => {
    await mountAt({ width: 1100 });
    const rows = within(screen.getByRole('navigation', { name: 'Comments' }))
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-thread-id'));
    const picked = rows[rows.length - 1] as HTMLElement;
    const threadId = picked.closest('[data-thread-id]')?.getAttribute('data-thread-id') ?? null;
    fireEvent.click(picked);
    await settle();

    act(() => {
      useAppStore
        .getState()
        .navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'comments' }) });
    });
    await settle();

    const list = within(screen.getByRole('navigation', { name: 'Comments' }));
    const current = list
      .getAllByRole('button')
      .map((row) => row.closest('[data-thread-id]'))
      .find((row) => row?.getAttribute('aria-current') === 'true');
    expect(current?.getAttribute('data-thread-id')).toBe(threadId);
  });

  it('keeps the list on a pane under 900px and opens the thread in the drawer, with no back link', async () => {
    await mountAt({ width: 384, threadId: EXPANDED_THREAD_ID });

    screen.getByRole('navigation', { name: 'Comments' });
    expect(screen.queryByRole('button', { name: /comments$/ })).toBeNull();
    expect(document.querySelector(`[data-review-drawer="${EXPANDED_THREAD_ID}"]`)).not.toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('shows the list and the thread on a base pane, with no property that only repeats the host', async () => {
    await mountAt({ width: 950, threadId: EXPANDED_THREAD_ID });

    screen.getByRole('navigation', { name: 'Comments' });
    expect(screen.queryByRole('button', { name: /^Comments$/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Comment properties' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('keeps the properties inline under the thread at 1279px of pane', async () => {
    await mountAt({ width: 1279, threadId: EXPANDED_THREAD_ID });

    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('keeps the properties inline under the thread on the widest panes, with no margin rail', async () => {
    for (const width of [1280, 1920]) {
      await mountAt({ width, threadId: EXPANDED_THREAD_ID });

      screen.getByRole('navigation', { name: 'Comments' });
      expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
      expect(screen.queryByText('Origin')).toBeNull();
      cleanup();
      vi.restoreAllMocks();
    }
  });

  it('keeps the full list in a 1024px window with a wide sidebar while the drawer reads the thread', async () => {
    await mountAt({ width: 1024 - LEFT_SIDEBAR_MAX });
    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'conversation',
        sessionId: SESSION.id,
        payload: { threadId: EXPANDED_THREAD_ID },
      });
    });
    await settle();

    screen.getByRole('navigation', { name: 'Comments' });
    expect(document.querySelector(`[data-review-drawer="${EXPANDED_THREAD_ID}"]`)).not.toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });
});

describe('Branch page Checks and Changes', () => {
  it('lists the checks of the pull request on its own section', async () => {
    await mount();

    await visit(/^Checks/);

    expect(screen.getByRole('region', { name: 'Checks' })).toBeDefined();
  });

  it('offers the new pull request form on Overview and lets the other sections render', async () => {
    await mount();
    dropRequest();
    await visit(/^Pull request/);
    expect(screen.queryByRole('heading', { name: 'No pull request yet' })).toBeNull();
    expect(railRow(/^Pull request/).textContent).toBe('Pull request');
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();

    await visit(/^Changes/);

    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(railRow(/^Changes/).getAttribute('aria-selected')).toBe('true');
  });

  it('explains there is no diff when the session has no worktree', async () => {
    await mount();

    await visit(/^Changes/);

    expect(screen.getByText('No branch in this session')).toBeDefined();
  });
});

describe('Branch page entries in the sidebar', () => {
  const mountFiles = async (): Promise<void> => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();
  };

  const fileRail = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-slot="diff-file-rail"] aside[aria-label="Files"]');

  it('counts Changes on its tab and puts the file list on the right of the page', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedShownPullRequest();
    await mountFiles();
    expect(fileRail()).toBeNull();
    expect(railRow(/^Changes/).hasAttribute('aria-expanded')).toBe(false);
    expect(railRow(/^Changes/).textContent).toMatch(/^Changes\d/);

    await visit(/^Changes/);
    const rail = fileRail();
    if (rail === null) {
      throw new Error('the Changes entry opens no file rail');
    }
    expect(railRow(/^Changes/).getAttribute('aria-selected')).toBe('true');
    expect(railRow(/^Changes/).hasAttribute('aria-expanded')).toBe(false);
    expect(railOf().contains(rail)).toBe(false);
    expect(document.querySelector('[data-branch-pane]')?.lastElementChild?.contains(rail)).toBe(
      true,
    );
    const tree = within(rail).getByRole('navigation', { name: 'Changed files' });
    expect(headerColumnElement().contains(tree)).toBe(false);
    expect(within(rail).getByRole('searchbox', { name: 'Filter files' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: /^Next unviewed/ })).toBeDefined();

    for (const name of [/^Comments/, /^Commits/, /^Checks/]) {
      await visit(name);
      expect(fileRail()).toBeNull();
      expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    }
  });

  it('keeps the diff in the page when no tree hosts the entries', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();
    act(() => {
      useAppStore.getState().navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'files' }) });
    });
    await settle();

    expect(screen.getAllByText(/credit\.ts/).length).toBeGreaterThan(0);
  });
});

const seedWorktreeRecord = (): void => {
  useAppStore.setState({
    sessionWorktreeRecords: {
      [SESSION.id]: [
        {
          id: 'worktree-payments-api',
          sessionId: SESSION.id,
          worktreePath: WORKTREE,
          branch: MOUNT.branch,
          parallelIndex: 0,
          projectId: PROJECT_ID,
          mountName: 'payments-api',
          repoSlug: 'harborline/payments-api',
          createdAt: 1,
        },
      ],
    },
  });
};

const stripTab = (name: RegExp): HTMLElement =>
  within(screen.getByRole('tablist', { name: 'Branch pages' })).getByRole('tab', { name });

const stripCount = (name: RegExp): string =>
  (stripTab(name).textContent ?? '').replace(/^[A-Za-z ]+/, '').trim();

const NOTE_PLACE = { filePath: 'src/credit.ts', line: 1 };
const NOTE_PLACES = {
  open: NOTE_PLACE,
  openSecond: NOTE_PLACE,
  working: NOTE_PLACE,
  needs: NOTE_PLACE,
  ready: NOTE_PLACE,
  failed: NOTE_PLACE,
  done: NOTE_PLACE,
};
const OPEN_NOTE_IDS = [NOTE_IDS.open, NOTE_IDS.openSecond, NOTE_IDS.working];

const seedOpenNotes = ({ isKeepingThreads }: { readonly isKeepingThreads: boolean }): void => {
  const seeded = resolveNotesFor({ sessionId: SESSION.id, places: NOTE_PLACES });
  const wanted = new Set(OPEN_NOTE_IDS);
  const notes = seeded.notes
    .filter((note) => wanted.has(note.id))
    .map((note) => ({ ...note, projectId: PROJECT_ID, branch: MOUNT.branch }));
  const entries = seeded.entries.filter((entry) => wanted.has(entry.thread.diffCommentId ?? ''));
  const attempts = seeded.attempts.filter((attempt) =>
    attempt.threadIds.some((threadId) =>
      entries.some((entry) => entry.thread.threadId === threadId),
    ),
  );
  act(() => {
    useAppStore.setState((state) => ({
      diffComments: { [SESSION.id]: notes },
      sessionResolveQueueItems: {
        ...state.sessionResolveQueueItems,
        [SESSION.id]: [
          ...(isKeepingThreads ? (state.sessionResolveQueueItems[SESSION.id] ?? []) : []),
          ...entries,
        ],
      },
      sessionResolveAttempts: { ...state.sessionResolveAttempts, [SESSION.id]: attempts },
    }));
  });
};

describe('Branch page Comments count', () => {
  it('counts the local notes the Comments page lists when there is no pull request', async () => {
    await mount();
    dropRequest();
    seedOpenNotes({ isKeepingThreads: false });
    await settle();

    expect(stripCount(/^Comments/)).toBe('3');
  });

  it('counts host threads and local notes together', async () => {
    await mount();
    const hostOnly = Number(stripCount(/^Comments/));
    seedWorktree({ isDiffLoaded: false });
    seedOpenNotes({ isKeepingThreads: true });
    await settle();

    expect(hostOnly).toBeGreaterThan(0);
    expect(Number(stripCount(/^Comments/))).toBe(hostOnly + 3);
  });
});

describe('Branch page tab and head facts', () => {
  const STATUS = {
    branch: MOUNT.branch,
    head: COMMITS[0]?.sha ?? null,
    headSubject: 'Commit 1',
    upstreamDistance: { kind: 'known', ahead: 3, behind: 0 },
    mainDistance: { kind: 'known', ahead: 3, behind: 0 },
    workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
    upstream: 'origin/hl/fix-duplicate-credit',
    inProgress: null,
  };

  const holdReads = ({ summaryFiles = 2 }: { readonly summaryFiles?: number } = {}) => {
    const held: { release: () => void } = { release: () => undefined };
    const gate = new Promise<void>((resolve) => {
      held.release = resolve;
    });
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'worktree_diff') {
        await gate;
        return PATCH;
      }
      if (command === 'worktree_status') {
        await gate;
        return STATUS;
      }
      if (command === 'worktree_commits') {
        await gate;
        return COMMITS;
      }
      if (command === 'worktree_diff_files') {
        return [];
      }
      if (command === 'worktree_changed_files') {
        await gate;
        return {
          paths: Array.from({ length: summaryFiles }, (_, index) => `src/file${index}.ts`),
          entries: [],
          additions: summaryFiles,
          deletions: 0,
          numstat: '',
        };
      }
      return new Promise<never>(() => undefined);
    });
    return held;
  };

  it('shows the same files and commits on the tab and in the Changes head, before and after loading', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedShownPullRequest();
    seedWorktree({ isDiffLoaded: false });
    seedWorktreeRecord();
    const held = holdReads();
    observers = installFakeResizeObserver();
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(stripCount(/^Changes/)).toBe('');
    expect(stripCount(/^Commits/)).toBe('');

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1400, 600),
    );
    act(() => observers?.resizeAll());
    held.release();
    await settle();
    act(() => {
      useAppStore.getState().navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'files' }) });
    });
    await settle();

    expect(stripCount(/^Changes/)).toBe('2+2 -0');
    expect(stripCount(/^Commits/)).toBe('3');

    const rail = document.querySelector<HTMLElement>(
      '[data-slot="diff-file-rail"] aside[aria-label="Files"]',
    );
    expect(rail).not.toBeNull();
    within(rail!).getByText(/Viewed 0 of 2/);
    screen.getByText('· All 3 commits');
    expect(stripCount(/^Changes/)).toBe('2+2 -0');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 700, 600),
    );
    act(() => observers?.resizeAll());
    await settle();
    const toggle = screen.getByRole('button', { name: /^Files/ });
    expect((toggle.textContent ?? '').replace(/^Files/, '')).toBe(stripCount(/^Changes/));
  });

  it('keeps the rail on the loaded diff when the polled summary disagrees', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedShownPullRequest();
    seedWorktree({ isDiffLoaded: false });
    seedWorktreeRecord();
    const held = holdReads({ summaryFiles: 5 });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    held.release();
    await settle();
    act(() => {
      useAppStore.getState().navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'files' }) });
    });
    await settle();

    expect(stripCount(/^Changes/)).toBe('5+5 -0');
    const rail = document.querySelector<HTMLElement>(
      '[data-slot="diff-file-rail"] aside[aria-label="Files"]',
    );
    within(rail!).getByText(/Viewed 0 of 2/);
  });

  it('keeps the Changes tab on the branch when the summary fails and the scope changes', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedShownPullRequest();
    seedWorktree({ isDiffLoaded: false });
    seedWorktreeRecord();
    const held = holdReads();
    const base = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation(
      async (command: string, args?: Parameters<typeof invoke>[1]) => {
        if (command === 'worktree_changed_files') {
          throw new Error('summary failed');
        }
        if (command === 'worktree_diff_working' || command === 'worktree_diff_commit') {
          return PATCH.split('diff --git a/src/webhook.ts')[0] ?? '';
        }
        return base?.(command, args);
      },
    );
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    held.release();
    await settle();
    act(() => {
      useAppStore.getState().navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'files' }) });
    });
    await settle();
    expect(stripCount(/^Changes/)).toBe('2');

    const pick = async (label: string): Promise<void> => {
      fireEvent.click(screen.getByRole('button', { name: /^(Compared with|Working tree|Commit)/ }));
      fireEvent.click(screen.getByText(label));
      await settle();
    };
    await pick('Commit 1');
    expect(stripCount(/^Changes/)).toBe('');
    await pick('working tree');
    expect(stripCount(/^Changes/)).toBe('');
    await pick('branch vs main');
    expect(stripCount(/^Changes/)).toBe('2');
  });
});
