import { expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { STORY_NOW } from '../../../store/storyHarness';
import {
  type Ctx,
  type Row,
  WAIT,
  both,
  click,
  clickButton,
  clickFirstButton,
  heading,
  lens,
  openCrumb,
  openPalette,
  settle,
  useAppStore,
  visible,
} from './harness';

const trailNav = (): HTMLElement => screen.getByRole('navigation', { name: 'Breadcrumb' });

const trailReads =
  (...labels: ReadonlyArray<string>) =>
  async (): Promise<void> => {
    const pattern = new RegExp(labels.map((label) => label.replace('#', '#\\d*')).join('.*'));
    await waitFor(() => expect(trailNav().textContent ?? '').toMatch(pattern), WAIT);
  };

const clickCrumb = async (label: RegExp): Promise<void> => {
  await click(within(trailNav()).getByRole('button', { name: label }));
};

const stackDepth = (): number => {
  const state = useAppStore.getState();
  return state.navigation[state.currentWorkspaceId ?? '']?.entries.length ?? 0;
};

const openDiffThenPr = async (): Promise<void> => {
  await openCrumb(/^Diff/);
  await clickButton(/^Open PR #\d+$/);
};

const openPrThenReview = async (): Promise<void> => {
  await clickFirstButton(/^Open PR #\d+ of /);
  await openPalette(/^Open Review/);
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

const openPullRequestPage = async (): Promise<void> => {
  await clickFirstButton(/^Open PR #\d+ of /);
};

const markPullRequestForeign = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const github = state.sessionGithub[sessionId];
  if (github === undefined || github.pr === null) {
    throw new Error('the pr seed has no session pull request');
  }
  const pr = { ...github.pr, author: 'kenji-w' };
  useAppStore.setState({
    githubStatus: { mode: 'gh-cli', available: true, user: 'mara-l' },
    sessionGithub: { ...state.sessionGithub, [sessionId]: { ...github, pr } },
    mountGithub: Object.fromEntries(
      Object.entries(state.mountGithub).map(([mountId, entry]) => [
        mountId,
        entry.pr?.number === pr.number
          ? {
              ...entry,
              pr,
              prs: entry.prs.map((candidate) => (candidate.number === pr.number ? pr : candidate)),
            }
          : entry,
      ]),
    ),
    sessionProjectPrs: Object.fromEntries(
      Object.entries(state.sessionProjectPrs).map(([key, byProject]) => [
        key,
        Object.fromEntries(
          Object.entries(byProject).map(([projectId, prs]) => [
            projectId,
            prs.map((candidate) => (candidate.number === pr.number ? pr : candidate)),
          ]),
        ),
      ]),
    ),
  });
};

export const PULL_REQUEST_LAYER_ROWS: ReadonlyArray<Row> = [
  {
    name: 'pull request page from the mount row',
    covers: ['openMountRequest', 'openReviewTarget'],
    open: () => clickFirstButton(/^Open PR #\d+ of /),
    lands: both(lens('pr'), () => heading(/Stop retried webhooks/)),
  },
  {
    name: 'mount row: comments to resolve open Review',
    covers: ['openReviewTarget', 'lens:review'],
    open: async (ctx) => {
      seedReviewComment(ctx);
      await settle();
      await clickFirstButton(/^Open Review for .+, 1 to resolve$/);
    },
    lands: both(lens('review'), () => heading('Review')),
  },
  {
    name: 'mount row menu: rewrite history',
    covers: ['openRewriteHistory'],
    open: async () => {
      const [row] = await screen.findAllByTestId('project-mount-row');
      await click(within(row!).getByRole('button', { name: / on .+ actions$/ }));
      await click(await screen.findByRole('menuitem', { name: /^Rewrite history/ }));
    },
    lands: () => heading('Rewrite history'),
  },
  {
    name: 'diff to its pull request',
    covers: ['openMountRequest', 'lens:pr'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Open PR #\d+$/);
    },
    lands: both(lens('pr'), () => heading(/Stop retried webhooks/)),
  },
  {
    name: 'layers: the diff then its pull request read Overview, Diff, Pull request',
    covers: ['navigate', 'layer:diff>pr'],
    open: openDiffThenPr,
    lands: both(lens('pr'), trailReads('Overview', 'Diff', 'Pull request', '#')),
  },
  {
    name: 'layers: the Diff crumb pops back from the pull request',
    covers: ['navigate', 'layer:crumb-pop'],
    open: async () => {
      await openDiffThenPr();
      await clickCrumb(/^Diff$/);
    },
    lands: both(lens('files'), () => heading('Diff'), trailReads('Overview', 'Diff')),
  },
  {
    name: 'layers: Back removes the pull request layer from the diff',
    covers: ['back', 'layer:back'],
    open: async () => {
      await openDiffThenPr();
      await clickButton(/^Back/);
    },
    lands: both(lens('files'), () => heading('Diff')),
  },
  {
    name: 'layers: Review opened on the pull request stacks on it',
    covers: ['navigate', 'layer:pr>review'],
    open: openPrThenReview,
    lands: both(lens('review'), trailReads('Overview', 'PR #', 'Review')),
  },
  {
    name: 'layers: the pull request link inside Review pops to it, no copy',
    covers: ['navigate', 'layer:pop-to-kind'],
    open: async () => {
      await openPrThenReview();
      const depth = stackDepth();
      await clickButton(/^Open pull request #\d+/);
      expect(stackDepth()).toBe(depth);
    },
    lands: both(lens('pr'), () => heading(/Stop retried webhooks/)),
  },
  {
    name: 'layers: the pull request crumb pops back from Review',
    covers: ['navigate', 'layer:crumb-pop'],
    open: async () => {
      await openPrThenReview();
      await clickCrumb(/^PR #\d+$/);
    },
    lands: lens('pr'),
  },
  {
    name: 'layers: comments to resolve open Review under the Overview alone',
    covers: ['openReviewTarget', 'layer:overview>review'],
    open: async (ctx) => {
      seedReviewComment(ctx);
      await settle();
      await clickFirstButton(/^Open Review for .+, 1 to resolve$/);
    },
    lands: async () => {
      await waitFor(() => expect(trailNav().textContent ?? '').not.toMatch(/PR #/), WAIT);
    },
  },
  {
    name: 'layers: the pull request quiet line opens Review on top of it',
    covers: ['openReviewTarget', 'layer:pr>review'],
    open: async (ctx) => {
      seedReviewComment(ctx);
      await settle();
      await openPullRequestPage();
      await clickButton(/^1 comment to resolve/);
    },
    lands: both(lens('review'), trailReads('Overview', 'PR #', 'Review')),
  },
  {
    name: 'layers: the pull request quiet line opens its diff',
    covers: ['navigate', 'layer:pr>diff'],
    open: async () => {
      await openPullRequestPage();
      await clickButton(/^Changes on this branch/);
    },
    lands: both(lens('files'), () => heading('Diff')),
  },
  {
    name: "layers: Write review on someone else's pull request",
    covers: ['navigate', 'layer:pr>write-review'],
    open: async (ctx) => {
      markPullRequestForeign(ctx);
      await settle();
      await openPullRequestPage();
      await clickButton(/^Write review$/);
    },
    lands: async (ctx) => {
      await lens('pr')(ctx);
      await waitFor(
        () => expect(useAppStore.getState().pullRequestModes[ctx.sessionId]).toBe('write_review'),
        WAIT,
      );
    },
  },
  {
    name: 'layers: Restore a backup in the Diff menu opens the Backups of Rewrite history',
    covers: ['openRewriteHistory', 'layer:diff>history'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Diff actions$/);
      await click(await screen.findByRole('menuitem', { name: /^Restore a backup/ }));
    },
    lands: () => visible('region', 'Backups'),
  },
  {
    name: 'diff menu: Change base branch opens the picker in place',
    covers: ['layer:diff-base'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Diff actions$/);
      await click(await screen.findByRole('menuitem', { name: /^Change base branch/ }));
    },
    lands: async () => {
      expect(await screen.findByText('Compare with', undefined, WAIT)).toBeDefined();
    },
  },
  {
    name: 'review header pull request link',
    covers: ['navigate', 'lens:pr'],
    open: async () => {
      await openCrumb(/^Review/);
      await clickButton(/^Open pull request #\d+/);
    },
    lands: both(lens('pr'), () => heading(/Stop retried webhooks/)),
  },
];
