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
    name: 'sidebar: Terminal open, the session row carries the only current sign',
    covers: ['navigate', 'sidebar:current-sign'],
    open: async () => openCrumb(/^Terminal/),
    lands: async (ctx) => {
      await heading('Terminal');
      await waitFor(() => {
        const signs = currentSigns();
        expect(signs).toHaveLength(1);
        expect(signs[0]).toBe(rowOf(ctx.sessionId));
      }, WAIT);
    },
  },
  {
    name: 'sidebar: on a page the card marks that page and no other row',
    covers: ['navigate', 'sidebar:current-sign'],
    open: async () => openCrumb(/^Agents/),
    lands: async (ctx) => {
      await heading('Agents');
      await waitFor(() => {
        const signs = currentSigns();
        expect(signs).toHaveLength(1);
        expect(signs[0]?.textContent ?? '').toMatch(/^Agents/);
        expect(rowOf(ctx.sessionId).getAttribute('aria-current')).toBeNull();
      }, WAIT);
    },
  },
  {
    name: 'crumb: on the Branch page the Session crumb opens the Pages menu and Runs lands',
    covers: ['navigate', 'trail:session-crumb-pages'],
    open: async () => {
      await openCrumb(/^Branch/);
      await click(await screen.findByRole('button', { name: /^Switch page: / }, WAIT));
      await click(await screen.findByRole('menuitemradio', { name: /^Runs/ }, WAIT));
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
    name: 'sidebar: two branches, switching from the sidebar moves the page and the crumb to the landing tab',
    covers: ['navigate', 'sidebar:branch-rows'],
    open: async (ctx) => {
      addSecondBranch(ctx);
      await openCrumb(/^Branch/);
      await click(await screen.findByRole('tab', { name: /^Commits/ }, WAIT));
      await waitFor(
        () => expect(useAppStore.getState().branchTab[ctx.sessionId]).toBe('commits'),
        WAIT,
      );
      const rows = within(await screen.findByRole('list', { name: 'Branches' }, WAIT));
      expect(rows.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
      await click(rows.getByRole('button', { name: new RegExp(SECOND_BRANCH) }));
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
      await screen.findByRole('button', { name: `Branch ${SECOND_BRANCH}` }, WAIT);
      const rows = within(await screen.findByRole('list', { name: 'Branches' }, WAIT));
      await waitFor(() => {
        const current = rows
          .getAllByRole('button')
          .filter((row) => row.getAttribute('aria-current') === 'true');
        expect(current).toHaveLength(1);
        expect(current[0]?.getAttribute('aria-label') ?? '').toContain(SECOND_BRANCH);
      }, WAIT);
    },
  },
  {
    name: 'rail: with the sidebar collapsed, hovering the session button lists the pages and Runs lands',
    covers: ['navigate', 'rail:session-flyout'],
    open: async () => {
      await clickButton(/^Hide sidebar/);
      const button = await waitFor(() => {
        const found = document.querySelector<HTMLElement>('[data-rail-session]');
        expect(found).not.toBeNull();
        return found as HTMLElement;
      }, WAIT);
      fireEvent.mouseEnter(button);
      const card = await screen.findByRole('dialog', { name: 'Session pages' }, WAIT);
      await click(within(card).getByRole('button', { name: /^Runs/ }));
    },
    lands: async (ctx) => {
      await heading('Runs');
      expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe('workflows');
      expect(screen.queryByRole('dialog', { name: 'Session pages' })).toBeNull();
    },
  },
  {
    name: 'pins: pin from the header menu, Move down from the row menu, and the order survives a reload',
    covers: ['pin:header-toggle', 'row menu: Move down'],
    open: async (ctx) => {
      otherId = otherSessionId(ctx.sessionId);
      const titleRow = document.querySelector<HTMLElement>('[data-slot="pane-title-row"]');
      expect(titleRow).not.toBeNull();
      await click(
        within(titleRow as HTMLElement).getByRole('button', { name: 'More session actions' }),
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
