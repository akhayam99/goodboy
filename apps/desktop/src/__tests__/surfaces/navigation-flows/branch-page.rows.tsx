import { expect } from 'vitest';
import { waitFor } from '@testing-library/react';
import { STORY_NOW } from '../../../store/storyHarness';
import {
  type Ctx,
  type Row,
  WAIT,
  both,
  branchPageReady,
  branchTab,
  changesTab,
  click,
  clickBackArrow,
  clickButton,
  heading,
  lens,
  openBranchFiles,
  openCrumb,
  openWorktreeEntry,
  openPalette,
  settle,
  useAppStore,
  findSection,
} from './harness';

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
    name: 'branch page from the worktree row of the session level',
    covers: ['lens:branch'],
    open: () => openCrumb(/Branch/),
    lands: both(branchTab('pr'), ownPage),
  },
  {
    name: 'branch page: the Comments tab opens the Branch on its Comments',
    covers: ['lens:branch'],
    open: async (ctx) => {
      seedReviewComment(ctx);
      await settle();
      await openWorktreeEntry(/^Comments/);
    },
    lands: branchTab('comments'),
  },
  {
    name: 'door: Files lands on the Changes tab',
    covers: ['navigate', 'sidebar:files-door'],
    open: () => openPalette(/^Open changes/),
    lands: changesTab,
  },
  {
    name: 'door: Comments lands on the Branch Comments tab',
    covers: ['navigate', 'sidebar:comments-door'],
    open: () => openPalette(/^Open comments/),
    lands: both(branchTab('comments'), branchPageReady),
  },
  {
    name: 'tabs: switching a tab edits the address in place, and Back leaves the Branch for the Context tab',
    covers: ['back', 'branch:tabs-in-place'],
    open: async () => {
      await openBranchFiles();
      const depth = stackDepth();
      await click(await findSection(/^Commits/));
      await click(await findSection(/^Checks/));
      await click(await findSection(/^Comments/));
      expect(stackDepth()).toBe(depth);
      await clickBackArrow();
    },
    lands: lens('context'),
  },
];
