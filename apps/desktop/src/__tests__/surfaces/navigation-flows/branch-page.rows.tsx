import { expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { STORY_NOW } from '../../../store/storyHarness';
import {
  type Ctx,
  type Row,
  WAIT,
  both,
  branchTab,
  click,
  clickButton,
  clickFirstButton,
  heading,
  lens,
  openBranchFiles,
  openPalette,
  settle,
  useAppStore,
  findSection,
} from './harness';

const worktreeMarked = async (): Promise<void> => {
  await waitFor(() => {
    const projects = document.querySelector(
      '[data-level-layer="session"]:not([inert]) [aria-labelledby="level-projects-label"]',
    );
    expect(projects?.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  }, WAIT);
};

const sessionLevelShown = async (): Promise<void> => {
  await waitFor(
    () =>
      expect(document.querySelector('[data-level-layer="session"]:not([inert])')).not.toBeNull(),
    WAIT,
  );
};

const stackDepth = (): number => {
  const state = useAppStore.getState();
  return state.navigation[state.currentWorkspaceId ?? '']?.entries.length ?? 0;
};

const seedReviewComment = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[sessionId]?.[0];
  const github = mount === undefined ? undefined : state.mountGithub[mount.mountId];
  if (mount === undefined || github === undefined || github.pr === null) {
    throw new Error('the pr seed has no mount pull request');
  }
  const comment = {
    id: 'navigation-comment-1',
    source: 'review',
    threadId: 'PRRT_navigation_1',
    resolved: false,
    inReplyToId: null,
    author: 'kenji-w',
    body: 'Cap the retries at three.',
    createdAt: STORY_NOW,
    path: 'src/importer.ts',
    line: 12,
  } as unknown as NonNullable<typeof github.detail>['comments'][number];
  useAppStore.setState({
    mountGithub: {
      ...state.mountGithub,
      [mount.mountId]: {
        ...github,
        detail: {
          ...(github.detail ?? { reviews: [], checks: [], reviewRequests: [] }),
          prNumber: github.pr.number,
          comments: [comment],
        },
      } as typeof github,
    },
  });
};

const ownPage = (): Promise<void> => heading(/Stop retried webhooks/);

export const BRANCH_PAGE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'branch page from the mount row',
    covers: ['openMountRequest', 'openReviewTarget'],
    open: () => clickFirstButton(/^Open PR #\d+ of /),
    lands: both(branchTab('pr'), ownPage),
  },
  {
    name: 'mount row: comments to resolve open the Branch on its Comments',
    covers: ['openReviewTarget', 'lens:branch'],
    open: async (ctx) => {
      seedReviewComment(ctx);
      await settle();
      await clickFirstButton(/^Open Comments for .+, 1 to resolve$/);
    },
    lands: both(branchTab('comments'), worktreeMarked),
  },
  {
    name: 'door: Files lands on the Branch with its worktree row current',
    covers: ['navigate', 'sidebar:files-door'],
    open: () => openPalette(/^Open Files/),
    lands: both(branchTab('files'), worktreeMarked),
  },
  {
    name: 'door: Comments lands on the Branch Comments tab with the session level on screen',
    covers: ['navigate', 'sidebar:comments-door'],
    open: () => openPalette(/^Open Comments/),
    lands: both(branchTab('comments'), sessionLevelShown),
  },
  {
    name: 'tabs: switching a tab edits the address in place, and Back leaves the Branch',
    covers: ['back', 'branch:tabs-in-place'],
    open: async () => {
      await openBranchFiles();
      const depth = stackDepth();
      await click(await findSection(/^Commits/));
      await click(await findSection(/^Checks/));
      await click(await findSection(/^Comments/));
      expect(stackDepth()).toBe(depth);
      await clickButton(/^Back(?! to Sessions$)/);
    },
    lands: lens(null),
  },
];
