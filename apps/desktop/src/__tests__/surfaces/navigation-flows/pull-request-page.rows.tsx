import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { attentionPlace } from '../../../features/session/attentionPlace';
import {
  type Ctx,
  type Row,
  WAIT,
  both,
  branchTab,
  click,
  clickFirstButton,
  heading,
  openCrumb,
  settle,
  useAppStore,
} from './harness';
import { clearGhWrites, ghWrites } from './pull-request-page.runner';

const stopSyncs = (): void => {
  useAppStore.setState({
    refreshSessionPr: async () => undefined,
    refreshSessionPrDetail: async () => undefined,
    recordSessionEventOnce: async () => undefined,
    updateResolveThreads: async () => undefined,
    materializeReviewThreads: async () => 0,
    reconcileResolveLane: async () => undefined,
    reconcileHandReplies: async () => 0,
    syncSourceSnapshots: async () => undefined,
  });
};

const approveAndTurnGreen = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const github = state.sessionGithub[sessionId];
  const mountId = state.sessionProjectMounts[sessionId]?.[0]?.mountId;
  if (github === undefined || github.pr === null || mountId === undefined) {
    throw new Error('the pr seed has no pull request to approve');
  }
  const pr = {
    ...github.pr,
    state: 'approved' as const,
    isDraft: false,
    mergeable: true,
    checks: 'success' as const,
    reviewDecision: 'approved' as const,
    baseBranch: 'main',
  };
  const detail = {
    prNumber: pr.number,
    comments: [],
    reviews: [],
    reviewRequests: [],
    checks: [],
    checksRead: 'ok' as const,
    checksError: null,
    reviewsRead: 'ok' as const,
    reviewsError: null,
    reviewRequestsRead: 'ok' as const,
    reviewRequestsError: null,
  };
  const mountGithub = state.mountGithub[mountId];
  useAppStore.setState({
    sessionGithub: { ...state.sessionGithub, [sessionId]: { ...github, pr, detail } },
    ...(mountGithub === undefined
      ? {}
      : {
          mountGithub: {
            ...state.mountGithub,
            [mountId]: { ...mountGithub, pr, prs: [pr], detail },
          },
        }),
    sessionProjectPrs: { ...state.sessionProjectPrs, [sessionId]: {} },
    sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [sessionId]: [] },
    sessionResolveAttempts: { ...state.sessionResolveAttempts, [sessionId]: [] },
  });
};

const openPrPage = async (ctx: Ctx): Promise<void> => {
  stopSyncs();
  await clickFirstButton(/^Open PR #\d+ of /);
  await branchTab('pr')(ctx);
};

const tabLabels = (): ReadonlyArray<string> =>
  screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');

const activity = (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: 'Activity' }, WAIT);

export const PULL_REQUEST_PAGE_ROWS: ReadonlyArray<Row> = [
  {
    name: 'pull request page: a branch with a pull request lands on the Pull request tab, first of the five',
    covers: ['openMountRequest', 'openReviewTarget', 'tab:pr'],
    open: async () => {
      stopSyncs();
      await clickFirstButton(/^Open PR #\d+ of /);
    },
    lands: both(
      branchTab('pr'),
      () => heading(/Stop retried webhooks/),
      async () => {
        expect(tabLabels()[0]).toMatch(/^Pull request/);
        expect(tabLabels()).toHaveLength(5);
      },
    ),
  },
  {
    name: 'pull request page: edit the description, Save, and the activity shows the edit',
    covers: ['navigate', 'tab:pr', 'pr-page:description'],
    open: async (ctx) => {
      await openPrPage(ctx);
      await activity();
      const description = await screen.findByRole('region', { name: 'Description' }, WAIT);
      await click(within(description).getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Description, markdown' }), {
        target: { value: 'Retried webhooks no longer post a second credit.' },
      });
      clearGhWrites();
      await click(screen.getByRole('button', { name: 'Save' }));
    },
    lands: async () => {
      expect(
        await within(await activity()).findByText(/edited the description/, undefined, WAIT),
      ).toBeDefined();
      expect(ghWrites().some((args) => args[0] === 'pr' && args[1] === 'edit')).toBe(true);
      expect(screen.queryByRole('textbox', { name: 'Description, markdown' })).toBeNull();
    },
  },
  {
    name: 'pull request page: with no pull request the branch lands on Files and the Pull request tab offers Create',
    covers: ['navigate', 'tab:pr', 'pr-page:create'],
    seed: 'issue',
    open: async () => {
      stopSyncs();
      await openCrumb(/^Branch/);
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      await click(await screen.findByRole('tab', { name: /^Pull request/ }));
      await branchTab('pr')(ctx);
      expect(
        await screen.findByRole('heading', { name: 'No pull request yet' }, WAIT),
      ).toBeDefined();
    },
  },
  {
    name: 'pull request page: Merge opens the confirm, a method is picked and one info toast follows',
    covers: ['navigate', 'tab:pr', 'pr-page:merge'],
    open: async (ctx) => {
      await openPrPage(ctx);
      approveAndTurnGreen(ctx);
      await settle();
      clearGhWrites();
      await click(
        await waitFor(() => {
          const button = document.querySelector<HTMLElement>(
            '[data-branch-primary="pullRequest.merge"]',
          );
          expect(button).not.toBeNull();
          return button as HTMLElement;
        }, WAIT),
      );
      const methods = await screen.findByRole('tablist', { name: 'Merge method' }, WAIT);
      expect(
        within(methods)
          .getByRole('tab', { name: /Merge commit/ })
          .hasAttribute('disabled'),
      ).toBe(true);
      await click(within(methods).getByRole('tab', { name: /Rebase and merge/ }));
      const confirm = within(screen.getByRole('group', { name: /^Merge #\d+ into main/ }));
      await click(confirm.getByRole('button', { name: 'Merge' }));
      await settle(8);
    },
    lands: async () => {
      await waitFor(
        () =>
          expect(
            ghWrites().some(
              (args) => args[0] === 'pr' && args[1] === 'merge' && args.includes('--rebase'),
            ),
          ).toBe(true),
        WAIT,
      );
      expect(await screen.findAllByText(/^Merged #\d+ into main$/, undefined, WAIT)).toHaveLength(
        1,
      );
    },
  },
  {
    name: 'pull request page: the mark of an approved session lands on the Pull request tab',
    covers: ['navigate', 'tab:pr', 'pr-page:mark'],
    open: async (ctx) => {
      stopSyncs();
      const state = useAppStore.getState();
      useAppStore.getState().navigate({
        to: attentionPlace({ state, sessionId: ctx.sessionId, reason: 'pr-approved' }),
      });
      await settle();
    },
    lands: both(branchTab('pr'), () => heading(/Stop retried webhooks/)),
  },
];
