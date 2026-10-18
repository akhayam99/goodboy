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
import { WorktreeEntriesSlot } from '../../../../app/components/MockScene/scenes/WorktreeEntriesSlot';
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
      <WorktreeEntriesSlot />
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

const railRow = (name: RegExp): HTMLElement => within(railOf()).getByRole('button', { name });

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
});

describe('Branch page header and sections', () => {
  it('names the pull request and lists Overview, Comments, Files, Commits and Checks in the rail', async () => {
    await mount();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      useAppStore.getState().sessionGithub[SESSION.id]?.pr?.title,
    );
    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits', 'Checks']);
    expect(railRow(/^Comments/).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('tablist', { name: /^Branch/ })).toBeNull();
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
    expect(railRow(/^Checks/).getAttribute('aria-current')).toBe('page');
    expect(railRow(/^Comments/).getAttribute('aria-current')).toBeNull();
  });

  it('moves between sections with Up and Down while the rail has focus', async () => {
    await mount();
    await visit(/^Comments/);
    railRow(/^Comments/).focus();

    fireEvent.keyDown(railRow(/^Comments/), { key: 'ArrowDown' });
    await settle();
    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('files');
    expect(document.activeElement).toBe(railRow(/^Files/));

    fireEvent.keyDown(railRow(/^Files/), { key: 'ArrowUp' });
    await settle();
    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('comments');
    expect(document.activeElement).toBe(railRow(/^Comments/));

    fireEvent.keyDown(railRow(/^Comments/), { key: 'ArrowUp' });
    await settle();
    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('pr');
    fireEvent.keyDown(railRow(/^Pull request/), { key: 'ArrowUp' });
    await settle();
    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('pr');
  });
});

describe('Branch page sections by state', () => {
  it('keeps Overview, Files and Commits with no pull request and no comment, and no Checks', async () => {
    await mount();
    dropRequest();
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Files', 'Commits']);
  });

  it('adds Comments to a branch with no pull request once one local note exists', async () => {
    await mount();
    dropRequest();
    act(() => {
      useAppStore.setState({ diffComments: { [SESSION.id]: [aNote()] } });
    });
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits']);
    expect(railRow(/^Comments/).textContent).toBe('Comments');
  });

  it.each(['draft', 'open', 'merged', 'closed', 'queued'] as const)(
    'lists all five sections for a %s pull request',
    async (state) => {
      await mount();
      patchRequest({ state, isDraft: state === 'draft' });
      await settle();

      expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits', 'Checks']);
    },
  );

  it('falls back to Files when the section in the address does not exist in the state', async () => {
    await mount();
    dropRequest();
    act(() => {
      useAppStore.setState({ branchTab: { [SESSION.id]: 'comments' } });
    });
    await settle();

    expect(railRow(/^Files/).getAttribute('aria-current')).toBe('page');
  });

  it('puts no primary in the header of a merged pull request and draws its state in the property block', async () => {
    await mount();
    patchRequest({ state: 'merged', isDraft: false });
    await visit(/^Pull request/);

    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    const header = document.querySelector('[data-slot="pane-header"]');
    expect(header?.querySelector('[data-slot="branch-state"]') ?? null).toBeNull();
    expect(document.querySelector('[data-slot="branch-state"]')?.getAttribute('data-tone')).toBe(
      'merged',
    );
  });

  it('shows the queue in the Readiness property of a queued pull request and no primary', async () => {
    await mount();
    patchRequest({ state: 'queued', isDraft: false, mergeQueue: { position: 3 } });
    await visit(/^Pull request/);

    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    expect(screen.getByTestId('branch-queue-line').textContent).toBe(
      'Queued to merge, 3rd in line',
    );
  });

  it('shows no Rebase and no Apply in the Commits of a merged pull request', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <WorktreeEntriesSlot />
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
  it('keeps the header and the body of Comments, Files and Commits on the column at every section', async () => {
    await mount();

    for (const name of [/^Comments/, /^Files/, /^Commits/]) {
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
        <WorktreeEntriesSlot />
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    for (const name of [/^Comments/, /^Files/, /^Commits/]) {
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
      /^Files/,
      /^Commits/,
      /^Checks/,
      /^Files/,
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
    });
    render(
      <ToastProvider>
        <WorktreeEntriesSlot />
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    for (const name of [/^Files/, /^Commits/, /^Checks/]) {
      const row = railRow(name);
      expect(row.querySelector('[data-entry-slot]')).toBeNull();
      expect(row.textContent).not.toMatch(/[0-]/);
    }
  });

  it('fills each slot as the data arrives, the commits not pushed as an arrow', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits({ remoteSha: 'c'.repeat(40) });
    render(
      <ToastProvider>
        <WorktreeEntriesSlot />
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(countOf(/^Files/)).toBe('2');
    expect(countOf(/^Commits/)).toBe('↑3');
    expect(Number(countOf(/^Comments/))).toBeGreaterThan(0);
  });
});

describe('Branch page counts before any visit', () => {
  const countOf = (name: RegExp): string =>
    railRow(name).textContent?.replace(/^[A-Za-z]+/, '') ?? '';

  it('loads the commit history once when the page opens, and shows all three counts without a visit', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    const loadHistoryDraft = vi.fn(async () => {
      withCommits({ remoteSha: 'c'.repeat(40) });
    });
    useAppStore.setState({ loadHistoryDraft });
    render(
      <ToastProvider>
        <WorktreeEntriesSlot />
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(loadHistoryDraft).toHaveBeenCalledTimes(1);
    expect(loadHistoryDraft).toHaveBeenCalledWith({ sessionId: SESSION.id, mountId: MOUNT_ID });
    expect(railRow(/^Comments/).getAttribute('aria-current')).toBe('page');
    expect(countOf(/^Files/)).toBe('2');
    expect(countOf(/^Commits/)).toBe('↑3');
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
        <WorktreeEntriesSlot />
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(loadHistoryDraft).not.toHaveBeenCalled();
    expect(countOf(/^Commits/)).toBe('↑3');
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

describe('Branch page Checks and Files', () => {
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

    await visit(/^Files/);

    expect(screen.queryByRole('textbox', { name: 'Pull request title' })).toBeNull();
    expect(railRow(/^Files/).getAttribute('aria-current')).toBe('page');
  });

  it('explains there is no diff when the session has no worktree', async () => {
    await mount();

    await visit(/^Files/);

    expect(screen.getByText('No worktree for this session')).toBeDefined();
  });
});

describe('Branch page entries in the sidebar', () => {
  const mountFiles = async (): Promise<void> => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <WorktreeEntriesSlot />
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();
  };

  const fileRail = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-slot="diff-file-rail"] aside[aria-label="Files"]');

  it('draws the entries in the sidebar slot and never beside the page', async () => {
    await mountFiles();

    const slot = document.querySelector('[data-slot="worktree-level-entries"]');
    expect(slot?.contains(railOf())).toBe(true);
    expect(document.querySelector('[data-branch-pane]')?.contains(railOf())).toBe(false);
    expect(screen.queryByRole('button', { name: 'Sections' })).toBeNull();
  });

  it('keeps Files a plain entry with its count and puts the file list on the right of the page', async () => {
    await mountFiles();
    expect(fileRail()).toBeNull();
    expect(railRow(/^Files/).hasAttribute('aria-expanded')).toBe(false);
    expect(railRow(/^Files/).getAttribute('aria-label')).toMatch(/^Files, \d+$/);

    await visit(/^Files/);
    const rail = fileRail();
    if (rail === null) {
      throw new Error('the Files entry opens no file rail');
    }
    expect(railRow(/^Files/).getAttribute('aria-current')).toBe('page');
    expect(railRow(/^Files/).hasAttribute('aria-expanded')).toBe(false);
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

  it('keeps the diff in the page when no sidebar hosts the entries', async () => {
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

    expect(screen.queryByRole('navigation', { name: 'Worktree' })).toBeNull();
    expect(screen.getAllByText(/credit\.ts/).length).toBeGreaterThan(0);
  });
});
