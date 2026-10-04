import { expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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
  openCrumb,
  openPalette,
  settle,
  useAppStore,
} from './harness';

const trailNav = (): HTMLElement => screen.getByRole('navigation', { name: 'Breadcrumb' });

const trailReads =
  (...labels: ReadonlyArray<string>) =>
  async (): Promise<void> => {
    const pattern = new RegExp(labels.map((label) => label.replace('#', '#\\d*')).join('.*'));
    await waitFor(() => expect(trailNav().textContent ?? '').toMatch(pattern), WAIT);
  };

const stackDepth = (): number => {
  const state = useAppStore.getState();
  return state.navigation[state.currentWorkspaceId ?? '']?.entries.length ?? 0;
};

const BRANCH_TRAIL = ['Overview', '#', 'Stop retried webhooks'];

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
    lands: both(branchTab('comments'), ownPage),
  },
  {
    name: 'mount row: comments to resolve open the Branch on its Comments',
    covers: ['openReviewTarget', 'lens:branch'],
    open: async (ctx) => {
      seedReviewComment(ctx);
      await settle();
      await clickFirstButton(/^Open Review for .+, 1 to resolve$/);
    },
    lands: both(branchTab('comments'), trailReads(...BRANCH_TRAIL)),
  },
  {
    name: 'trail: the Diff door reads Overview then the Branch',
    covers: ['navigate', 'trail:diff-door'],
    open: () => openCrumb(/^Diff/),
    lands: both(branchTab('files'), trailReads(...BRANCH_TRAIL)),
  },
  {
    name: 'trail: the Review door reads the same Overview then the Branch',
    covers: ['navigate', 'trail:review-door'],
    open: () => openPalette(/^Open Review/),
    lands: both(branchTab('comments'), trailReads(...BRANCH_TRAIL)),
  },
  {
    name: 'tabs: switching a tab edits the address in place, and Back leaves the Branch',
    covers: ['back', 'trail:tabs-in-place'],
    open: async () => {
      await openCrumb(/^Diff/);
      const depth = stackDepth();
      await click(await screen.findByRole('tab', { name: /^Commits/ }));
      await click(await screen.findByRole('tab', { name: /^Checks/ }));
      await click(await screen.findByRole('tab', { name: /^Comments/ }));
      expect(stackDepth()).toBe(depth);
      await clickButton(/^Back/);
    },
    lands: lens(null),
  },
  {
    name: 'trail: the Branch crumb menu lists the branches of the session',
    covers: ['trail:branch-menu'],
    open: async () => {
      await openCrumb(/^Diff/);
      const crumb = within(trailNav()).getByRole('button', { name: /Stop retried webhooks/ });
      await click(crumb);
    },
    lands: async () => {
      expect(await screen.findAllByRole('menuitemradio', undefined, WAIT)).not.toHaveLength(0);
    },
  },
];
