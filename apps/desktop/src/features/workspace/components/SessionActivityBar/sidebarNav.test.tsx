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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MountId, Session, SessionId, SessionProjectMount } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { branchLandingTabOf } from '../../../branch/branchLandingTab';
import {
  harborline,
  mountGithubOf,
  mountOf,
  paymentsApi,
  renderBar,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const open = sessionOf({ goal: 'Fix webhook retries', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const other = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
});

const idOf = (session: Session) => session.id as SessionId;

const mountOpen = (session: Session = open) => {
  seedColumn({ store: useAppStore, sessions: [open, other], currentSessionId: idOf(session) });
  useAppStore.setState({ sessionBranches: { [session.id]: 'goodboy/webhook-retries' } });
  return renderBar();
};

const markedPages = () => Array.from(document.querySelectorAll('[aria-current="page"]'));

const sessionRow = (title: string) => screen.getByRole('button', { name: title });

describe('the pages chevron', () => {
  it('folds and shows the pages, with its state and a label naming the session', () => {
    mountOpen();
    const fold = screen.getByRole('button', { name: 'Fold the pages of Fix webhook retries' });
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: 'Pages' })).toBeDefined();

    fireEvent.click(fold);

    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
    const show = screen.getByRole('button', { name: 'Show the pages of Fix webhook retries' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    expect(useAppStore.getState().sessionPagesFolded[idOf(open)]).toBe(true);

    fireEvent.click(show);

    expect(screen.getByRole('list', { name: 'Pages' })).toBeDefined();
    expect(useAppStore.getState().sessionPagesFolded[idOf(open)]).toBeUndefined();
  });

  it('is on the open session only', () => {
    mountOpen();
    expect(document.querySelectorAll('[data-slot="pages-chevron"]')).toHaveLength(1);
  });

  it('keeps the fold of a session across a switch away and back', () => {
    mountOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Fold the pages of Fix webhook retries' }));
    act(() => {
      useAppStore.setState({ currentSessionId: idOf(other) });
    });
    expect(screen.getByRole('list', { name: 'Pages' })).toBeDefined();
    act(() => {
      useAppStore.setState({ currentSessionId: idOf(open) });
    });
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Show the pages of Fix webhook retries' }),
    ).toBeDefined();
  });

  it('still folds on Left and shows on Right', () => {
    mountOpen();
    const row = sessionRow('Fix webhook retries');
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(screen.getByRole('list', { name: 'Pages' })).toBeDefined();
  });
});

describe('the one current sign', () => {
  it('marks the page row that matches and leaves the session row plain', () => {
    mountOpen();
    act(() => {
      useAppStore.setState({ activeLens: { [open.id]: 'agents' } });
    });
    expect(markedPages()).toHaveLength(1);
    expect(markedPages()[0]?.textContent).toMatch(/^Agents/);
  });

  it.each(['terminal', 'scripts', 'explore'] as const)(
    'marks the session row on %s, which has no row of its own',
    (lens) => {
      mountOpen();
      act(() => {
        useAppStore.setState({ activeLens: { [open.id]: lens } });
      });
      expect(markedPages()).toHaveLength(1);
      expect(markedPages()[0]).toBe(sessionRow('Fix webhook retries'));
    },
  );

  it('marks the session row when the pages are folded', () => {
    mountOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Fold the pages of Fix webhook retries' }));
    expect(markedPages()).toEqual([sessionRow('Fix webhook retries')]);
  });

  it('remembers the session without a fill while a studio sits over it', () => {
    seedColumn({ store: useAppStore, sessions: [open, other], currentSessionId: idOf(open) });
    renderBar({ isStudioOver: true });
    expect(markedPages()).toHaveLength(0);
    const row = sessionRow('Fix webhook retries');
    expect(row.getAttribute('data-current-sign')).toBe('remembered');
  });

  it('lists Questions only while something is open, with the count word', () => {
    seedColumn({
      store: useAppStore,
      sessions: [open, other],
      currentSessionId: idOf(open),
      questions: [open],
    });
    renderBar();
    const pages = within(screen.getByRole('list', { name: 'Pages' }));
    const questions = pages.getByRole('button', { name: /^Questions/ });
    expect(questions.textContent).toContain('1 open');
  });

  it('has no Questions row when nothing is open', () => {
    mountOpen();
    const pages = within(screen.getByRole('list', { name: 'Pages' }));
    expect(pages.queryByRole('button', { name: /^Questions/ })).toBeNull();
  });

  it('marks the Questions page, not the session, when it is open and has a row', () => {
    seedColumn({
      store: useAppStore,
      sessions: [open, other],
      currentSessionId: idOf(open),
      questions: [open],
    });
    useAppStore.setState({ activeLens: { [open.id]: 'questions' } });
    renderBar();
    expect(markedPages()).toHaveLength(1);
    expect(markedPages()[0]?.textContent).toMatch(/^Questions/);
  });
});

describe('the pin slot of a row', () => {
  it('pins from an unpinned row and unpins from a pinned one', async () => {
    const pinSession = vi.fn(async () => undefined);
    const unpinSession = vi.fn(async () => undefined);
    mountOpen();
    useAppStore.setState({ pinSession, unpinSession });
    fireEvent.click(
      within(rowShell('Ledger export speedup')).getByRole('button', { name: 'Pin session' }),
    );
    expect(pinSession).toHaveBeenCalledWith(idOf(other));

    act(() => {
      useAppStore.setState({
        sessionPins: { [harborline.id]: [{ id: idOf(other), at: 1 }] },
      });
    });
    fireEvent.click(
      within(rowShell('Ledger export speedup')).getByRole('button', { name: 'Unpin session' }),
    );
    expect(unpinSession).toHaveBeenCalledWith(idOf(other));
  });

  it('is absent from an archived row', () => {
    const archived = sessionOf({ goal: 'Legacy hook cleanup' });
    seedColumn({ store: useAppStore, sessions: [open], archived: [archived] });
    useAppStore.setState({
      sessionViewPrefs: {
        [harborline.id]: {
          ...useAppStore.getState().getSessionViewPrefs(harborline.id),
          isArchivedShown: true,
        },
      },
    });
    renderBar();
    const shell = rowShell('Legacy hook cleanup');
    expect(within(shell).queryByRole('button', { name: /pin session/i })).toBeNull();
  });
});

const rowShell = (title: string): HTMLElement =>
  sessionRow(title).closest<HTMLElement>('.group\\/select-row') as HTMLElement;

const branchMount = ({ index, branch }: { readonly index: number; readonly branch: string }) =>
  ({
    ...mountOf({ session: open, project: paymentsApi }),
    mountId: `mount-branch-${index}` as MountId,
    worktreePath: `/tmp/payments-api/worktrees/${index}`,
    branch,
    parallelIndex: index,
  }) satisfies SessionProjectMount;

const withBranches = (count: number) => {
  const mounts = Array.from({ length: count }, (_, index) =>
    branchMount({ index, branch: `hl/branch-${index}` }),
  );
  seedColumn({ store: useAppStore, sessions: [open, other], currentSessionId: idOf(open) });
  useAppStore.setState({
    sessionBranches: { [open.id]: 'hl/branch-0' },
    sessionProjectMounts: { [open.id]: mounts },
    activeLens: { [open.id]: 'branch' },
    branchTab: { [open.id]: 'files' },
    branchThreadId: { [open.id]: 'thread-on-first' },
    diffMountPath: { [open.id]: mounts[0]?.worktreePath ?? null },
  });
  return mounts;
};

const branchesList = () => screen.queryByRole('list', { name: 'Branches' });

describe('the branches under the Branch page', () => {
  it('shows none for a single branch', () => {
    withBranches(1);
    renderBar();
    expect(branchesList()).toBeNull();
  });

  it('lists one row per branch under Branch when there are two', () => {
    withBranches(2);
    renderBar();
    const list = within(branchesList() as HTMLElement);
    expect(list.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Branch/ }).textContent).toMatch(/^Branch/);
  });

  it('shows five rows then All branches for six', () => {
    withBranches(6);
    renderBar();
    const list = within(branchesList() as HTMLElement);
    expect(list.getAllByRole('button')).toHaveLength(6);
    expect(list.getAllByRole('button').at(-1)?.textContent).toBe('All branches');
  });

  it('opens the Overview from All branches', () => {
    withBranches(6);
    renderBar();
    fireEvent.click(within(branchesList() as HTMLElement).getByText('All branches'));
    expect(useAppStore.getState().activeLens[idOf(open)] ?? null).toBeNull();
  });

  it('keeps them away while another page is the current one', () => {
    withBranches(3);
    useAppStore.setState({ activeLens: { [open.id]: 'agents' } });
    renderBar();
    expect(branchesList()).toBeNull();
  });

  it('marks the current branch and not the others', () => {
    withBranches(3);
    renderBar();
    const rows = within(branchesList() as HTMLElement).getAllByRole('button');
    expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual(['true', null, null]);
  });

  it('names the pull request state of a branch that has one', () => {
    const mounts = withBranches(2);
    const target = mounts[1] as SessionProjectMount;
    useAppStore.setState({
      mountGithub: { [target.mountId]: mountGithubOf({ mount: target, number: 331 }) },
    });
    renderBar();
    const rows = within(branchesList() as HTMLElement).getAllByRole('button');
    expect(rows[1]?.getAttribute('aria-label')).toContain('In review');
    expect(rows[0]?.getAttribute('aria-label')).not.toContain('In review');
  });

  it('lands on the landing tab of the target branch, with no thread or focus of the one left', async () => {
    const mounts = withBranches(2);
    const target = mounts[1] as SessionProjectMount;
    useAppStore.setState({
      setSessionActiveMount: vi.fn(async () => undefined),
      diffFocus: { [open.id]: { kind: 'branch', path: 'src/a.ts' } },
    });
    renderBar();

    fireEvent.click(within(branchesList() as HTMLElement).getAllByRole('button')[1] as HTMLElement);

    await waitFor(() =>
      expect(useAppStore.getState().diffMountPath[idOf(open)]).toBe(target.worktreePath),
    );
    const state = useAppStore.getState();
    expect(state.branchTab[idOf(open)]).toBe(
      branchLandingTabOf({ hasPullRequest: false, deepLink: null }),
    );
    expect(state.branchThreadId[idOf(open)] ?? null).toBeNull();
    expect(state.diffFocus[idOf(open)] ?? null).toBeNull();
    await waitFor(() => {
      const rows = within(branchesList() as HTMLElement).getAllByRole('button');
      expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual([null, 'true']);
    });
  });
});
