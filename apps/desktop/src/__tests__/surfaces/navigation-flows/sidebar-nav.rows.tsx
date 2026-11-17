import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  MountId,
  SessionId,
  SessionMountView,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import {
  type Ctx,
  type Row,
  WAIT,
  branchPageReady,
  click,
  heading,
  openCrumb,
  openPalette,
  pressBoardKey,
  sessionLevel,
  settle,
  useAppStore,
} from './harness';

const SECOND_MOUNT_ID = 'navigation-mount-sidebar-second' as MountId;
const SECOND_BRANCH = 'cs/second-sidebar-branch';
const SECOND_PATH = '/work/cascade-second-sidebar-branch';

const sessionsList = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[role="listbox"][aria-label="Sessions"]');

const idOfRow = (row: Element): string => {
  const text = row.textContent ?? '';
  const session = useAppStore
    .getState()
    .sessions.filter((candidate) => text.startsWith(candidate.goal))
    .sort((a, b) => b.goal.length - a.goal.length)[0];
  return session?.id ?? '';
};

const rowIds = (): ReadonlyArray<string> => {
  const list = sessionsList();
  return list === null ? [] : Array.from(list.querySelectorAll('[role="option"]'), idOfRow);
};

const openSessions = async (): Promise<void> => {
  if (sessionsList() !== null) {
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
  await settle();
};

const closeSessions = async (): Promise<void> => {
  if (sessionsList() === null) {
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
  await settle();
};

const cardOf = (sessionId: string): HTMLElement => {
  const card = document.querySelector<HTMLElement>(`article[data-select-id="${sessionId}"]`);
  expect(card).not.toBeNull();
  return card as HTMLElement;
};

const onBoard = async (): Promise<void> => {
  await closeSessions();
  if (document.querySelector('article[data-select-id]') !== null) {
    return;
  }
  await pressBoardKey();
};

const addSecondBranch = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  const first = mounts[0];
  if (first === undefined) {
    throw new Error('the pr seed has no mount to add a second branch next to');
  }
  const second: SessionProjectMount = {
    ...first,
    mountId: SECOND_MOUNT_ID,
    worktreePath: SECOND_PATH,
    lastWorktreePath: null,
    branch: SECOND_BRANCH,
    parallelIndex: 9,
  };
  const view: SessionMountView = {
    id: SECOND_MOUNT_ID,
    sessionId,
    projectId: second.projectId,
    worktreePath: SECOND_PATH,
    lastWorktreePath: null,
    branch: SECOND_BRANCH,
    baseBranch: second.baseBranch,
    parallelIndex: 9,
    mountName: second.mountName,
    repoSlug: null,
    repoRoot: second.repoRoot,
    isAttached: true,
    diskState: 'present',
    revision: second.revision,
    createdAt: STORY_NOW,
    updatedAt: STORY_NOW,
  };
  useAppStore.setState({
    sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: [...mounts, second] },
    sessionMounts: {
      ...state.sessionMounts,
      [sessionId]: [...(state.sessionMounts[sessionId] ?? []), view],
    },
  });
};

const currentSigns = (): ReadonlyArray<Element> =>
  Array.from(document.querySelectorAll('[data-shell-rail] [aria-current="page"]'));

const sessionTabs = (): HTMLElement => screen.getByRole('tablist', { name: 'Session pages' });

const tabSigns = (): ReadonlyArray<Element> =>
  Array.from(sessionTabs().querySelectorAll('[aria-selected="true"]'));

const otherSessionId = (current: SessionId): string => {
  const last = useAppStore
    .getState()
    .sessions.filter((session) => session.id !== current)
    .map((session) => session.id)
    .at(-1);
  expect(last).toBeDefined();
  return last as string;
};

const pinnedIds = (): ReadonlyArray<string> => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  return (state.sessionPins[workspaceId] ?? []).map((pin) => pin.id);
};

let otherId = '';

export const SIDEBAR_NAV_ROWS: ReadonlyArray<Row> = [
  {
    name: 'rail: a session keeps the Board lit on the places rail above no session level',
    covers: ['navigate', 'sidebar:current-sign', 'rail:session-level'],
    open: async () => {
      await openCrumb(/^Overview/);
    },
    lands: async (ctx) => {
      await waitFor(() => {
        const signs = currentSigns();
        expect(signs).toHaveLength(1);
        expect(signs[0]?.getAttribute('data-shell-rail-item')).toBe('board');
      }, WAIT);
      expect(useAppStore.getState().currentSessionId).toBe(ctx.sessionId);
      expect(document.querySelector('[data-shell-rail] [data-level-layer]')).toBeNull();
      expect(sessionTabs()).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Back to Sessions' })).toBeNull();
    },
  },
  {
    name: 'tabs: on a page the session tabs mark that page and no other tab',
    covers: ['navigate', 'sidebar:current-sign'],
    open: async () => openCrumb(/^Artifacts/),
    lands: async () => {
      await heading('Artifacts');
      await waitFor(() => {
        const signs = tabSigns();
        expect(signs).toHaveLength(1);
        expect(signs[0]?.textContent ?? '').toMatch(/^Artifacts/);
      }, WAIT);
    },
  },
  {
    name: 'palette: from the Branch page Open Runs lands',
    covers: ['navigate', 'sidebar:session-pages'],
    open: async () => {
      await openCrumb(/^Branch/);
      await openPalette(/^Open Runs/, 'Open Runs');
    },
    lands: async (ctx) => {
      await heading('Runs');
      await waitFor(
        () => expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe('workflows'),
        WAIT,
      );
    },
  },
  {
    name: 'context: two worktrees, the second one opens its Branch page on the landing tab',
    covers: ['navigate', 'sidebar:worktree-rows'],
    open: async (ctx) => {
      addSecondBranch(ctx);
      const projects = within(
        within(await sessionLevel()).getByRole('group', { name: 'Projects' }),
      );
      await click(
        projects.getByRole('button', {
          name: (name) => name.startsWith(`${SECOND_BRANCH},`) || name === SECOND_BRANCH,
        }),
      );
      await settle(8);
    },
    lands: async (ctx) => {
      await waitFor(
        () => expect(useAppStore.getState().diffMountPath[ctx.sessionId]).toBe(SECOND_PATH),
        WAIT,
      );
      const state = useAppStore.getState();
      expect(state.branchTab[ctx.sessionId]).toBe(branchLandingTabOf({ deepLink: null }));
      expect(state.branchThreadId[ctx.sessionId] ?? null).toBeNull();
      await branchPageReady();
    },
  },
  {
    name: 'pins: pin from the session head menu, Move down from the card menu, and the order survives a reload',
    covers: ['pin:head-menu', 'row menu: Move down'],
    open: async (ctx) => {
      otherId = otherSessionId(ctx.sessionId);
      await click(await screen.findByRole('button', { name: 'More session actions' }, WAIT));
      await click(await screen.findByRole('menuitem', { name: /^Pin session/ }, WAIT));
      await waitFor(() => expect(pinnedIds()).toEqual([ctx.sessionId]), WAIT);
      await useAppStore.getState().pinSession(otherId as SessionId);
      await waitFor(() => expect(pinnedIds()).toEqual([ctx.sessionId, otherId]), WAIT);
      await onBoard();
      fireEvent.contextMenu(cardOf(ctx.sessionId));
      await click(await screen.findByRole('menuitem', { name: 'Move down' }, WAIT));
      await waitFor(() => expect(pinnedIds()).toEqual([otherId, ctx.sessionId]), WAIT);
      useAppStore.setState({ sessionPins: {} });
      await useAppStore
        .getState()
        .loadSessionPins({ workspaceId: useAppStore.getState().currentWorkspaceId as WorkspaceId });
    },
    lands: async (ctx) => {
      await waitFor(() => expect(pinnedIds()).toEqual([otherId, ctx.sessionId]), WAIT);
      await openSessions();
      await waitFor(() => expect(rowIds().slice(0, 2)).toEqual([otherId, ctx.sessionId]), WAIT);
    },
  },
];
