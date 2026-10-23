import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { MountId, SessionMountView, SessionProjectMount } from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import {
  type Ctx,
  type Row,
  WAIT,
  branchTab,
  click,
  findSection,
  getSection,
  openCrumb,
  settle,
  useAppStore,
} from './harness';

const SECOND_MOUNT_ID = 'navigation-mount-second-branch' as MountId;
const SECOND_BRANCH = 'cs/second-branch';
const SECOND_PATH = '/work/cascade-second-branch';

const trailBands = (): number => document.querySelectorAll('main [data-slot="trail-bar"]').length;

const currentWorktree = (): string =>
  document.querySelector('[data-level-layer="session"]:not([inert]) [data-worktree-current]')
    ?.textContent ?? '';

const headerColumn = (): string | null =>
  document
    .querySelector('[data-slot="pane-header"] [data-page-column]')
    ?.getAttribute('data-width') ??
  document
    .querySelector('[data-slot="pane-header"]')
    ?.closest('[data-page-column]')
    ?.getAttribute('data-width') ??
  null;

const bodyColumns = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll('[data-slot="pane-body"] [data-page-column]'))
    .filter((column) => column.parentElement?.closest('[data-page-column]') === null)
    .map((column) => column.getAttribute('data-width'));

const visitTab = async (name: RegExp): Promise<void> => {
  await click(await findSection(name));
  await waitFor(() => expect(getSection(name).getAttribute('aria-current')).toBe('page'), WAIT);
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

const paneHeading = (): string | null =>
  document.querySelector('[data-slot="pane-header"] h1')?.textContent ?? null;

const openBranchPage = (): Promise<void> => openCrumb(/Branch/);

export const BRANCH_COLUMN_ROWS: ReadonlyArray<Row> = [
  {
    name: 'branch column: no trail band, the header and body stay on the column from tab to tab',
    covers: ['navigate', 'branch:column'],
    open: async (ctx) => {
      await openBranchPage();
      await branchTab('pr')(ctx);
      for (const name of [/^Pull request/, /^Comments/, /^Files/, /^Commits/, /^Checks/]) {
        await visitTab(name);
        expect(trailBands()).toBe(0);
        expect(headerColumn()).toBe('column');
      }
      for (const name of [/^Pull request/, /^Comments/, /^Files/, /^Commits/]) {
        await visitTab(name);
        expect(bodyColumns().length).toBeGreaterThan(0);
        expect(bodyColumns().every((width) => width === 'column')).toBe(true);
      }
    },
    lands: async (ctx) => {
      await branchTab('commits')(ctx);
      expect(trailBands()).toBe(0);
    },
  },
  {
    name: 'branch tree: a click on the row of a second branch moves the page to it on its landing tab, and the tree and header follow',
    covers: ['navigate', 'rail:session-level'],
    open: async (ctx) => {
      addSecondBranch(ctx);
      await openBranchPage();
      await branchTab('pr')(ctx);
      await visitTab(/^Files/);
      await click(await screen.findByRole('button', { name: SECOND_BRANCH }, WAIT));
      await settle(8);
    },
    lands: async (ctx) => {
      await waitFor(
        () => expect(useAppStore.getState().diffMountPath[ctx.sessionId]).toBe(SECOND_PATH),
        WAIT,
      );
      await waitFor(
        () =>
          expect(useAppStore.getState().branchTab[ctx.sessionId]).toBe(
            branchLandingTabOf({ deepLink: null }),
          ),
        WAIT,
      );
      await waitFor(() => expect(paneHeading()).toBe(SECOND_BRANCH), WAIT);
      await waitFor(() => expect(currentWorktree()).toContain(SECOND_BRANCH), WAIT);
      expect(trailBands()).toBe(0);
    },
  },
];
