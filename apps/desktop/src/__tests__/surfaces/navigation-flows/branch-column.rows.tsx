import { expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { MountId, SessionMountView, SessionProjectMount } from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import {
  type Ctx,
  type Row,
  WAIT,
  branchTab,
  click,
  clickFirstButton,
  settle,
  useAppStore,
} from './harness';

const SECOND_MOUNT_ID = 'navigation-mount-second-branch' as MountId;
const SECOND_BRANCH = 'cs/second-branch';
const SECOND_PATH = '/work/cascade-second-branch';

const trailColumn = (): string | null =>
  document
    .querySelector('main [data-slot="trail-bar"] [data-page-column]')
    ?.getAttribute('data-width') ?? null;

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
  await click(await screen.findByRole('tab', { name }));
  await waitFor(
    () => expect(screen.getByRole('tab', { name }).getAttribute('aria-selected')).toBe('true'),
    WAIT,
  );
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

const trailNav = (): HTMLElement => screen.getByRole('navigation', { name: 'Breadcrumb' });

const openBranchPage = (): Promise<void> => clickFirstButton(/^Open PR #\d+ of /);

export const BRANCH_COLUMN_ROWS: ReadonlyArray<Row> = [
  {
    name: 'branch column: the trail, header and body stay on the column from tab to tab',
    covers: ['navigate', 'trail:branch-column'],
    open: async (ctx) => {
      await openBranchPage();
      await branchTab('comments')(ctx);
      for (const name of [/^Comments/, /^Files/, /^Commits/, /^Checks/]) {
        await visitTab(name);
        expect(trailColumn()).toBe('column');
        expect(headerColumn()).toBe('column');
      }
      for (const name of [/^Comments/, /^Files/, /^Commits/]) {
        await visitTab(name);
        expect(bodyColumns().length).toBeGreaterThan(0);
        expect(bodyColumns().every((width) => width === 'column')).toBe(true);
      }
    },
    lands: async (ctx) => {
      await branchTab('commits')(ctx);
      expect(trailColumn()).toBe('column');
    },
  },
  {
    name: 'branch switcher: the chip moves the page to a second branch on its landing tab, and the crumb and header follow',
    covers: ['navigate', 'trail:branch-switcher'],
    open: async (ctx) => {
      addSecondBranch(ctx);
      await openBranchPage();
      await branchTab('comments')(ctx);
      await visitTab(/^Files/);
      const chip = await screen.findByRole(
        'button',
        { name: /^Branch (?!actions|\d+ branches)/ },
        WAIT,
      );
      expect(chip.querySelector('[data-slot="switcher-chevron"]')).not.toBeNull();
      await click(chip);
      const rows = await screen.findAllByRole('menuitemradio', undefined, WAIT);
      const second = rows.find((row) => (row.textContent ?? '').includes(SECOND_BRANCH));
      expect(second).toBeDefined();
      expect(rows.filter((row) => row.getAttribute('aria-checked') === 'true')).toHaveLength(1);
      await click(second as HTMLElement);
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
            branchLandingTabOf({ hasPullRequest: false, deepLink: null }),
          ),
        WAIT,
      );
      await waitFor(() => expect(paneHeading()).toBe(SECOND_BRANCH), WAIT);
      await screen.findByRole('button', { name: `Branch ${SECOND_BRANCH}` }, WAIT);
      expect(trailNav().textContent ?? '').toMatch(/Session.*Branch/);
      await click(within(trailNav()).getByRole('button', { name: /Branch/ }));
      const current = (await screen.findAllByRole('menuitemradio', undefined, WAIT)).filter(
        (row) => row.getAttribute('aria-checked') === 'true',
      );
      expect(current).toHaveLength(1);
      expect(current[0]?.textContent ?? '').toContain(SECOND_BRANCH);
      expect(trailColumn()).toBe('column');
    },
  },
];
