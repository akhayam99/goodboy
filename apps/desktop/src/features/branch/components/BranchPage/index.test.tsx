// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { LEFT_SIDEBAR_MAX } from '@goodboy/ui';
import type { BranchCommit, MountId, ProjectId, SessionProjectMount } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

describe('Branch page header and tabs', () => {
  it('names the pull request and offers Pull request, Comments, Files, Commits and Checks as tabs', async () => {
    await mount();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      useAppStore.getState().sessionGithub[SESSION.id]?.pr?.title,
    );
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
    expect(tabs.map((text) => text.replace(/[\d-]+$/, '').trim())).toEqual([
      'Pull request',
      'Comments',
      'Files',
      'Commits',
      'Checks',
    ]);
    expect(screen.getByRole('tab', { name: /^Comments/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('carries one primary at most and none of the controls of the neighbouring pages', async () => {
    await mount();

    expect(document.querySelectorAll('[data-branch-primary]').length).toBeLessThanOrEqual(1);
    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /^(Rewrite history|Open in Review|PR #\d+)/.test(name))).toEqual(
      [],
    );
  });

  it('switches tabs in the address without adding history', async () => {
    await mount();
    useAppStore.getState().navigate({
      to: {
        at: 'session',
        sessionId: SESSION.id,
        view: {
          lens: 'branch',
          agentId: null,
          studio: null,
          target: {
            kind: 'branch',
            mountPath: null,
            tab: 'comments',
            threadId: null,
            focus: null,
          },
        },
      },
    });
    const depth = depthOf();

    fireEvent.click(screen.getByRole('tab', { name: /^Checks/ }));
    await settle();

    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('checks');
    expect(depthOf()).toBe(depth);
    expect(screen.getByRole('tab', { name: /^Checks/ }).getAttribute('aria-selected')).toBe('true');
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
  it('keeps the header and the body of Comments, Files and Commits on the column at every tab', async () => {
    await mount();

    for (const name of [/^Comments/, /^Files/, /^Commits/]) {
      fireEvent.click(screen.getByRole('tab', { name }));
      await settle();

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
      fireEvent.click(screen.getByRole('tab', { name }));
      await settle();

      expect(headerColumn()).toBe('column');
      expect(bodyColumnWidths().length).toBeGreaterThan(0);
      expect(bodyColumnWidths().every((width) => width === 'column')).toBe(true);
    }
  });
});

describe('Branch page counts', () => {
  const countOf = (name: RegExp): string =>
    screen.getByRole('tab', { name }).textContent?.replace(/^[A-Za-z]+/, '') ?? '';

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
      const tab = screen.getByRole('tab', { name });
      expect(within(tab).getByRole('img', { name: 'Not loaded' })).toBeDefined();
      expect(tab.textContent).not.toMatch(/0/);
    }
    expect(within(screen.getByRole('tab', { name: /^Checks/ })).queryByRole('img')).toBeNull();
  });

  it('turns each dash into its number as the data arrives', async () => {
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
    expect(countOf(/^Files/)).toBe('2');
    expect(countOf(/^Commits/)).toBe('3');
    expect(Number(countOf(/^Comments/))).toBeGreaterThan(0);
  });
});

describe('Branch page tab counts before any visit', () => {
  const countOf = (name: RegExp): string =>
    screen.getByRole('tab', { name }).textContent?.replace(/^[A-Za-z]+/, '') ?? '';

  it('loads the commit history once when the page opens, and shows all three counts without a tab visit', async () => {
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
    expect(screen.getByRole('tab', { name: /^Comments/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryAllByRole('img', { name: 'Not loaded' })).toHaveLength(0);
    expect(countOf(/^Files/)).toBe('2');
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
  it('opens a thread by putting it in the address, and Comments leads back to the list', async () => {
    await mountAt({ width: 384 });

    fireEvent.click(
      screen
        .getByRole('navigation', { name: 'Comments' })
        .querySelector('[data-thread-id]') as HTMLElement,
    );
    await settle();
    expect(useAppStore.getState().branchThreadId[SESSION.id]).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Comments$/ }));
    await settle();
    expect(useAppStore.getState().branchThreadId[SESSION.id] ?? null).toBeNull();
  });

  it('keeps the selected thread on the list after Comments leads back', async () => {
    await mountAt({ width: 384 });
    const rows = within(screen.getByRole('navigation', { name: 'Comments' }))
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-thread-id'));
    const picked = rows[rows.length - 1] as HTMLElement;
    const threadId = picked.closest('[data-thread-id]')?.getAttribute('data-thread-id') ?? null;
    fireEvent.click(picked);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /^Comments$/ }));
    await settle();

    const list = within(screen.getByRole('navigation', { name: 'Comments' }));
    const current = list
      .getAllByRole('button')
      .map((row) => row.closest('[data-thread-id]'))
      .find((row) => row?.getAttribute('aria-current') === 'true');
    expect(current?.getAttribute('data-thread-id')).toBe(threadId);
  });

  it('shows one column on a pane under 900px: the list, or the open thread with Comments', async () => {
    await mountAt({ width: 384, threadId: EXPANDED_THREAD_ID });

    expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull();
    screen.getByRole('button', { name: /^Comments$/ });
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
    screen.getByRole('button', { name: /^Comments$/ });
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });
});

describe('Branch page Checks and Files', () => {
  it('lists the checks of the pull request on its own tab', async () => {
    await mount();

    fireEvent.click(screen.getByRole('tab', { name: /^Checks/ }));
    await settle();

    expect(screen.getByRole('region', { name: 'Checks' })).toBeDefined();
  });

  it('offers the new pull request form on its own tab and lets the other tabs render', async () => {
    await mount();
    act(() => {
      seedWorktree({ isDiffLoaded: false });
      useAppStore.setState((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [SESSION.id]: { ...state.sessionGithub[SESSION.id]!, pr: null },
        },
        sessionSelectedPrNumber: { ...state.sessionSelectedPrNumber, [SESSION.id]: null },
      }));
    });
    fireEvent.click(screen.getByRole('tab', { name: /^Pull request/ }));
    await settle();
    expect(screen.getByRole('heading', { name: 'No pull request yet' })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /^Checks/ }));
    await settle();

    expect(screen.queryByRole('heading', { name: 'No pull request yet' })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Checks/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('explains there is no diff when the session has no worktree', async () => {
    await mount();

    fireEvent.click(screen.getByRole('tab', { name: /^Files/ }));
    await settle();

    expect(screen.getByText('No worktree for this session')).toBeDefined();
  });
});

describe('Branch page files rail', () => {
  const mountFiles = async ({ width }: { readonly width: number }): Promise<void> => {
    seedResolveScene({ expandedThreadId: null });
    seedWorktree({ isDiffLoaded: true });
    withCommits();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, width, 600),
    );
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={WORKTREE} />
      </ToastProvider>,
    );
    await settle();
  };

  const visit = async (name: RegExp): Promise<void> => {
    fireEvent.click(screen.getByRole('tab', { name }));
    await settle();
  };

  const columnOf = (): HTMLElement =>
    document
      .querySelector('[data-slot="pane-header"]')
      ?.closest<HTMLElement>('[data-page-column]') as HTMLElement;

  const railOf = (): HTMLElement | null => screen.queryByRole('complementary', { name: 'Files' });

  it('keeps the column, the title and the tab strip the same elements from Comments to Files and back', async () => {
    await mountFiles({ width: 1920 });
    const column = columnOf();
    const title = screen.getByRole('heading', { level: 1 });
    const tabs = screen.getByRole('tablist', { name: 'Branch' });
    expect(column.getAttribute('data-width')).toBe('column');

    for (const name of [/^Files/, /^Comments/, /^Commits/, /^Files/, /^Checks/, /^Files/]) {
      await visit(name);

      expect(columnOf()).toBe(column);
      expect(column.getAttribute('data-width')).toBe('column');
      expect(screen.getByRole('heading', { level: 1 })).toBe(title);
      expect(screen.getByRole('tablist', { name: 'Branch' })).toBe(tabs);
    }
  });

  it('draws the rail on Files only, beside the column and never inside it', async () => {
    await mountFiles({ width: 1920 });
    expect(railOf()).toBeNull();

    await visit(/^Files/);
    const rail = railOf() as HTMLElement;
    expect(rail.getAttribute('data-rail')).toBe('docked');
    expect(columnOf().contains(rail)).toBe(false);
    const scope = columnOf().closest('[data-diff-rail-scope]') as HTMLElement;
    expect(rail.closest('[data-slot="diff-rail-host"]')?.parentElement).toBe(scope);

    for (const name of [/^Comments/, /^Commits/, /^Checks/]) {
      await visit(name);
      expect(railOf()).toBeNull();
      expect(screen.queryByRole('button', { name: /^Files, / })).toBeNull();
      expect(document.querySelector('[data-slot="diff-rail-host"]')).toBeNull();
    }
  });

  it.each([
    [1920, 'docked'],
    [1196, 'strip'],
    [1100, 'button'],
  ] as const)(
    'shows the tree as a %i pane wants it, %s, on the same column',
    async (width, mode) => {
      await mountFiles({ width });
      const column = columnOf();

      await visit(/^Files/);

      expect(columnOf()).toBe(column);
      const toolbar = document.querySelector('[data-slot="diff-toolbar"]') as HTMLElement;
      const strips = screen
        .queryAllByRole('button', { name: /^Files, / })
        .filter((button) => !toolbar.contains(button));
      expect(railOf()?.getAttribute('data-rail') ?? null).toBe(mode === 'docked' ? 'docked' : null);
      expect(strips).toHaveLength(mode === 'strip' ? 1 : 0);
      expect(within(toolbar).queryAllByRole('button', { name: /^Files, / })).toHaveLength(
        mode === 'button' ? 1 : 0,
      );
    },
  );
});
