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
  click,
  clickButton,
  heading,
  openCrumb,
  settle,
  useAppStore,
  findSection,
} from './harness';

const SECOND_MOUNT_ID = 'navigation-mount-sidebar-second' as MountId;
const SECOND_BRANCH = 'cs/second-sidebar-branch';
const SECOND_PATH = '/work/cascade-second-sidebar-branch';

const sessionsList = (): HTMLElement => {
  const list = document.querySelector<HTMLElement>('[data-column-sessions]');
  expect(list).not.toBeNull();
  return list as HTMLElement;
};

const rowOf = (sessionId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(
    `[data-column-sessions] button[data-select-id="${sessionId}"]`,
  );
  expect(row).not.toBeNull();
  return row as HTMLElement;
};

const rowIds = (): ReadonlyArray<string> =>
  Array.from(
    document.querySelectorAll('[data-column-sessions] button[data-select-id]'),
    (row) => row.getAttribute('data-select-id') ?? '',
  );

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
  Array.from(sessionsList().querySelectorAll('[aria-current="page"]'));

const sessionLevel = (): HTMLElement => {
  const level = document.querySelector<HTMLElement>('[data-level-layer="session"]:not([inert])');
  if (level === null) {
    throw new Error('the sidebar is not on a session level');
  }
  return level;
};

const levelSigns = (): ReadonlyArray<Element> =>
  Array.from(sessionLevel().querySelectorAll('[aria-current="page"]'));

const otherSessionId = (current: SessionId): string => {
  const last = rowIds()
    .filter((id) => id !== current)
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
    name: 'sidebar: a session keeps the workspace level with its row selected beside the session rail',
    covers: ['navigate', 'sidebar:current-sign', 'rail:session-level'],
    open: async () => {
      await openCrumb(/^Overview/);
    },
    lands: async (ctx) => {
      await waitFor(() => {
        const signs = currentSigns();
        expect(signs).toHaveLength(1);
        expect(signs[0]).toBe(rowOf(ctx.sessionId));
      }, WAIT);
      expect(useAppStore.getState().currentSessionId).toBe(ctx.sessionId);
      expect(document.querySelector('[data-column-layer="nav"] [data-level-layer]')).toBeNull();
      expect(sessionLevel().closest('[data-session-rail]')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Back to Sessions' })).toBeNull();
    },
  },
  {
    name: 'sidebar: on a page the session level marks that page and no other row',
    covers: ['navigate', 'sidebar:current-sign'],
    open: async () => openCrumb(/^Agents/),
    lands: async () => {
      await heading('Agents');
      await waitFor(() => {
        const signs = levelSigns();
        expect(signs).toHaveLength(1);
        expect(signs[0]?.textContent ?? '').toMatch(/^Agents/);
      }, WAIT);
    },
  },
  {
    name: 'sidebar: from the Branch page the Runs entry lands',
    covers: ['navigate', 'sidebar:session-pages'],
    open: async () => {
      await openCrumb(/^Branch/);
      await openCrumb(/^Runs/);
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
    name: 'sidebar: two worktrees, the second one opens its Branch page on the landing tab',
    covers: ['navigate', 'sidebar:worktree-rows'],
    open: async (ctx) => {
      addSecondBranch(ctx);
      await openCrumb(/^Branch/);
      await click(await findSection(/^Commits/));
      await waitFor(
        () => expect(useAppStore.getState().branchTab[ctx.sessionId]).toBe('commits'),
        WAIT,
      );
      await clickButton(/^Back to session /);
      const projects = within(within(sessionLevel()).getByRole('group', { name: 'Projects' }));
      await click(projects.getByRole('button', { name: new RegExp(SECOND_BRANCH) }));
      await settle(8);
    },
    lands: async (ctx) => {
      await waitFor(
        () => expect(useAppStore.getState().diffMountPath[ctx.sessionId]).toBe(SECOND_PATH),
        WAIT,
      );
      const state = useAppStore.getState();
      expect(state.branchTab[ctx.sessionId]).toBe(
        branchLandingTabOf({ hasPullRequest: false, deepLink: null }),
      );
      expect(state.branchThreadId[ctx.sessionId] ?? null).toBeNull();
      await waitFor(() => {
        const identity = document.querySelector(
          '[data-level-layer="worktree"]:not([inert]) [data-worktree-identity]',
        );
        expect(identity?.textContent ?? '').toContain(SECOND_BRANCH);
      }, WAIT);
    },
  },
  {
    name: 'rail: with the session rail folded, its session level icons open Runs',
    covers: ['navigate', 'rail:session-level'],
    open: async () => {
      await clickButton(/^Fold session rail/);
      const rail = await waitFor(() => {
        const found = document.querySelector<HTMLElement>('[data-session-rail="session"]');
        expect(found?.hasAttribute('data-rail-folded')).toBe(true);
        return found as HTMLElement;
      }, WAIT);
      await click(within(rail).getByRole('button', { name: /^Runs/ }));
    },
    lands: async (ctx) => {
      await heading('Runs');
      expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe('workflows');
    },
  },
  {
    name: 'pins: pin from the session menu, Move down from the row menu, and the order survives a reload',
    covers: ['pin:header-toggle', 'row menu: Move down'],
    open: async (ctx) => {
      otherId = otherSessionId(ctx.sessionId);
      const menu = document.querySelector<HTMLElement>('[data-rail-top] [data-session-menu]');
      expect(menu).not.toBeNull();
      await click(
        within(menu as HTMLElement).getByRole('button', { name: 'More session actions' }),
      );
      await click(await screen.findByRole('menuitem', { name: 'Pin session' }, WAIT));
      await waitFor(() => expect(pinnedIds()).toEqual([ctx.sessionId]), WAIT);
      await useAppStore.getState().pinSession(otherId as SessionId);
      await waitFor(() => expect(pinnedIds()).toEqual([ctx.sessionId, otherId]), WAIT);
      fireEvent.contextMenu(rowOf(ctx.sessionId));
      await click(await screen.findByRole('menuitem', { name: 'Move down' }, WAIT));
      await waitFor(() => expect(pinnedIds()).toEqual([otherId, ctx.sessionId]), WAIT);
      useAppStore.setState({ sessionPins: {} });
      await useAppStore
        .getState()
        .loadSessionPins({ workspaceId: useAppStore.getState().currentWorkspaceId as WorkspaceId });
    },
    lands: async (ctx) => {
      await waitFor(() => expect(pinnedIds()).toEqual([otherId, ctx.sessionId]), WAIT);
      await waitFor(() => expect(rowIds().slice(0, 2)).toEqual([otherId, ctx.sessionId]), WAIT);
    },
  },
];
