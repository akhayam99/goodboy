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
import { BranchPage } from './index';

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

const withCommits = (): void => {
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
        graph: null,
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

const railOf = (): HTMLElement => screen.getByRole('navigation', { name: 'Sections' });

const railRow = (name: RegExp): HTMLElement => within(railOf()).getByRole('button', { name });

const sectionNames = (): ReadonlyArray<string> =>
  within(railOf())
    .getAllByRole('button')
    .filter((button) => button.closest('[data-slot="branch-rail-files"]') === null)
    .map((button) => (button.textContent ?? '').replace(/[\d/-]+$/, '').trim());

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
    expect(sectionNames()).toEqual(['Overview', 'Comments', 'Files', 'Commits', 'Checks']);
    expect(railRow(/^Comments/).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('carries one primary at most and none of the controls of the neighbouring pages', async () => {
    await mount();

    expect(document.querySelectorAll('[data-branch-primary]').length).toBeLessThanOrEqual(1);
    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /^(Rewrite history|Open in Review|PR #\d+)/.test(name))).toEqual(
      [],
    );
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
    fireEvent.keyDown(railRow(/^Overview/), { key: 'ArrowUp' });
    await settle();
    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('pr');
  });
});

describe('Branch page sections by state', () => {
  it('keeps Overview, Files and Commits with no pull request and no comment, and no Checks', async () => {
    await mount();
    dropRequest();
    await settle();

    expect(sectionNames()).toEqual(['Overview', 'Files', 'Commits']);
  });

  it('adds Comments to a branch with no pull request once one local note exists', async () => {
    await mount();
    dropRequest();
    act(() => {
      useAppStore.setState({ diffComments: { [SESSION.id]: [aNote()] } });
    });
    await settle();

    expect(sectionNames()).toEqual(['Overview', 'Comments', 'Files', 'Commits']);
    expect(railRow(/^Comments/).textContent).toBe('Comments1');
  });

  it.each(['draft', 'open', 'merged', 'closed', 'queued'] as const)(
    'lists all five sections for a %s pull request',
    async (state) => {
      await mount();
      patchRequest({ state, isDraft: state === 'draft' });
      await settle();

      expect(sectionNames()).toEqual(['Overview', 'Comments', 'Files', 'Commits', 'Checks']);
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

  it('puts no primary in the header of a merged pull request and draws the chip in the merged tone', async () => {
    await mount();
    patchRequest({ state: 'merged', isDraft: false });
    await settle();

    expect(document.querySelectorAll('[data-branch-primary]')).toHaveLength(0);
    expect(document.querySelector('[data-slot="branch-state"]')?.getAttribute('data-tone')).toBe(
      'merged',
    );
  });

  it('shows the queue in the meta line of a queued pull request and no primary', async () => {
    await mount();
    patchRequest({ state: 'queued', isDraft: false, mergeQueue: { position: 3 } });
    await settle();

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
      /^Overview/,
      /^Comments/,
      /^Files/,
      /^Commits/,
      /^Checks/,
      /^Files/,
      /^Overview/,
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

  it('shows a muted dash named Not loaded while a count is unknown, never 0', async () => {
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
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    for (const name of [/^Comments/, /^Files/, /^Commits/]) {
      const row = railRow(name);
      expect(within(row).getByRole('img', { name: 'Not loaded' })).toBeDefined();
      expect(row.textContent).not.toMatch(/0/);
    }
    expect(within(railRow(/^Checks/)).queryByRole('img', { name: 'Not loaded' })).toBeNull();
  });

  it('turns each dash into its number as the data arrives, Files with its viewed ring', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(screen.queryAllByRole('img', { name: 'Not loaded' })).toHaveLength(0);
    expect(countOf(/^Files/)).toBe('0/2');
    expect(within(railRow(/^Files/)).getByRole('img', { name: '0 of 2 viewed' })).toBeDefined();
    expect(countOf(/^Commits/)).toBe('3');
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
      withCommits();
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
    expect(railRow(/^Comments/).getAttribute('aria-current')).toBe('page');
    expect(screen.queryAllByRole('img', { name: 'Not loaded' })).toHaveLength(0);
    expect(countOf(/^Files/)).toBe('0/2');
    expect(countOf(/^Commits/)).toBe('3');
    expect(Number(countOf(/^Comments/))).toBeGreaterThan(0);
  });

  it('does not load the history again when the draft is already there', async () => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    const loadHistoryDraft = vi.fn(async () => undefined);
    useAppStore.setState({ loadHistoryDraft });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();

    expect(loadHistoryDraft).not.toHaveBeenCalled();
    expect(countOf(/^Commits/)).toBe('3');
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

  it('shows one column on a pane under 900px: the open thread with no back link of its own', async () => {
    await mountAt({ width: 384, threadId: EXPANDED_THREAD_ID });

    expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Comments$/ })).toBeNull();
    expect(screen.getAllByRole('group', { name: 'Comment properties' })).toHaveLength(1);
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('shows the list and the thread on a base pane, with the properties inside the thread', async () => {
    await mountAt({ width: 950, threadId: EXPANDED_THREAD_ID });

    screen.getByRole('navigation', { name: 'Comments' });
    expect(screen.queryByRole('button', { name: /^Comments$/ })).toBeNull();
    const groups = screen.getAllByRole('group', { name: 'Comment properties' });
    expect(groups).toHaveLength(1);
    expect(within(groups[0] as HTMLElement).queryByText('State')).toBeNull();
    within(groups[0] as HTMLElement).getByText('Origin');
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('keeps the properties inline under the thread at 1279px of pane', async () => {
    await mountAt({ width: 1279, threadId: EXPANDED_THREAD_ID });

    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
    expect(screen.getAllByRole('group', { name: 'Comment properties' })).toHaveLength(1);
  });

  it('keeps the properties inline under the thread on the widest panes, with no margin rail', async () => {
    for (const width of [1280, 1920]) {
      await mountAt({ width, threadId: EXPANDED_THREAD_ID });

      screen.getByRole('navigation', { name: 'Comments' });
      expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
      const groups = screen.getAllByRole('group', { name: 'Comment properties' });
      expect(groups).toHaveLength(1);
      within(groups[0] as HTMLElement).getByText('Origin');
      cleanup();
      vi.restoreAllMocks();
    }
  });

  it('reads one column in a 1024px window with a wide sidebar and an open drawer', async () => {
    await mountAt({ width: 1024 - LEFT_SIDEBAR_MAX, threadId: EXPANDED_THREAD_ID });
    useAppStore.getState().openDrawer({
      kind: 'conversation',
      sessionId: SESSION.id,
      payload: { threadId: EXPANDED_THREAD_ID },
    });
    await settle();

    expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Comments$/ })).toBeNull();
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
    await visit(/^Overview/);
    expect(screen.getByRole('heading', { name: 'No pull request yet' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();

    await visit(/^Files/);

    expect(screen.queryByRole('heading', { name: 'No pull request yet' })).toBeNull();
    expect(railRow(/^Files/).getAttribute('aria-current')).toBe('page');
  });

  it('explains there is no diff when the session has no worktree', async () => {
    await mount();

    await visit(/^Files/);

    expect(screen.getByText('No worktree for this session')).toBeDefined();
  });
});

describe('Branch page rail', () => {
  const mountFiles = async ({ width }: { readonly width: number }): Promise<void> => {
    observers = installFakeResizeObserver();
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, width, 600),
    );
    act(() => observers?.resizeAll());
    await settle();
  };

  const dockedRail = (): HTMLElement | null =>
    screen.queryByRole('complementary', { name: 'Branch sections' });

  const sectionsButton = (): HTMLElement | null =>
    screen.queryByRole('button', { name: 'Sections' });

  const filesGroup = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('[data-slot="branch-rail-files"]');

  const pressSections = (): void => {
    const button = sectionsButton();
    if (button === null) {
      throw new Error('the page has no Sections button');
    }
    fireEvent.click(button);
  };

  const pressScrim = (): void => {
    const scrim = document.querySelector<HTMLElement>('[data-branch-rail-scrim]');
    if (scrim === null) {
      throw new Error('the page has no scrim');
    }
    fireEvent.click(scrim);
  };

  it('docks the rail at a sheet of 780 and hides it behind a Sections button at 760', async () => {
    await mountFiles({ width: 780 });
    expect(dockedRail()).not.toBeNull();
    expect(sectionsButton()).toBeNull();
    cleanup();
    vi.restoreAllMocks();

    await mountFiles({ width: 760 });
    expect(dockedRail()).toBeNull();
    expect(sectionsButton()).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
  });

  it('opens the hidden rail over the detail with a scrim, and closes it on Esc, a scrim click or a pick', async () => {
    await mountFiles({ width: 700 });

    pressSections();
    await settle();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeDefined();
    expect(document.querySelector('[data-branch-rail-scrim]')).not.toBeNull();
    expect(sectionsButton()?.getAttribute('aria-expanded')).toBe('true');

    await userEvent.keyboard('{Escape}');
    await settle();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();

    pressSections();
    await settle();
    pressScrim();
    await settle();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();

    pressSections();
    await settle();
    await visit(/^Commits/);
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('commits');
  });

  it('docks the rail again as soon as the window allows', async () => {
    await mountFiles({ width: 700 });
    expect(dockedRail()).toBeNull();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1200, 600),
    );
    act(() => observers?.resizeAll());
    await settle();

    expect(dockedRail()).not.toBeNull();
    expect(sectionsButton()).toBeNull();
  });

  it('draws the Files group in the rail on Files only, beside the column and never inside it', async () => {
    await mountFiles({ width: 1920 });
    expect(filesGroup()?.childElementCount ?? 0).toBe(0);

    await visit(/^Files/);
    const group = filesGroup();
    if (group === null) {
      throw new Error('the rail has no Files group');
    }
    const tree = within(group).getByRole('navigation', { name: 'Changed files' });
    expect(railOf().contains(tree)).toBe(true);
    const column = headerColumnElement();
    expect(column.contains(tree)).toBe(false);
    expect(within(group).getByRole('textbox', { name: 'Filter files' })).toBeDefined();
    expect(within(group).getByRole('tablist', { name: 'Show files' })).toBeDefined();
    expect(within(group).getByRole('button', { name: /^Next unviewed/ })).toBeDefined();

    for (const name of [/^Comments/, /^Commits/, /^Checks/]) {
      await visit(name);
      expect(filesGroup()?.childElementCount ?? 0).toBe(0);
      expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    }
  });

  it('keeps the Files group in the overlay rail and closes the overlay after a pick', async () => {
    await mountFiles({ width: 700 });
    useAppStore.getState().navigate({ to: branchPlace({ sessionId: SESSION.id, tab: 'files' }) });
    await settle();
    expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();

    pressSections();
    await settle();
    const tree = screen.getByRole('navigation', { name: 'Changed files' });
    const first = within(tree).getAllByRole('button', { name: /credit\.ts|webhook\.ts/ })[0];
    if (first === undefined) {
      throw new Error('the tree has no file row');
    }
    fireEvent.click(first);
    await settle();

    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
  });
});
