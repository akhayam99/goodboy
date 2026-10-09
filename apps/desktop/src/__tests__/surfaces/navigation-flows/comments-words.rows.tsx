import { expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  AgentId,
  PrComment,
  ResolveBatch,
  ResolvePublicationPreview,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import type { SessionGithubState } from '../../../store/types';
import { buildItem, buildThread } from '../../../app/components/MockScene/scenes/resolveSeed';
import {
  type Ctx,
  type Row,
  WAIT,
  branchTab,
  click,
  clickButton,
  openCrumb,
  settle,
  useAppStore,
} from './harness';

const PUBLISH_ERROR = JSON.stringify({ error: 'rejected: the remote has newer commits' });

type Seed = {
  readonly threadId: string;
  readonly author: string;
  readonly path: string;
  readonly body: string;
  readonly stage: 'proposed' | 'asking' | 'new';
};

const SEEDS: ReadonlyArray<Seed> = [
  {
    threadId: 'PRRT_journey_typo',
    author: 'kenji-w',
    path: 'src/config.ts',
    body: "Typo: 'shoudl' should be 'should'.",
    stage: 'proposed',
  },
  {
    threadId: 'PRRT_journey_redact',
    author: 'kenji-w',
    path: 'src/logging.ts',
    body: 'Redact the payload before it is logged.',
    stage: 'proposed',
  },
  {
    threadId: 'PRRT_journey_shape',
    author: 'omar-t',
    path: 'src/errorShape.ts',
    body: 'What should the client see once the retry budget runs out?',
    stage: 'asking',
  },
];

const OPEN_SEEDS: ReadonlyArray<Seed> = [
  {
    threadId: 'PRRT_journey_jitter',
    author: 'dana-r',
    path: 'src/backoff.ts',
    body: 'Jitter should be capped, not unbounded.',
    stage: 'new',
  },
  {
    threadId: 'PRRT_journey_queue',
    author: 'dana-r',
    path: 'src/queue.ts',
    body: 'Is this ordering guaranteed across merchants?',
    stage: 'new',
  },
  {
    threadId: 'PRRT_journey_metric',
    author: 'owen-h',
    path: 'src/metrics.ts',
    body: 'Same loop should emit a metric when it retries.',
    stage: 'new',
  },
];

const commentOf = ({
  seed,
  index,
}: {
  readonly seed: Seed;
  readonly index: number;
}): PrComment => ({
  id: `journey-comment-${index}`,
  author: seed.author,
  authorAvatarUrl: null,
  body: seed.body,
  createdAt: STORY_NOW,
  url: `https://github.com/harborline/payments-api/pull/318#discussion_${index}`,
  source: 'review',
  path: seed.path,
  line: 10 + index,
  resolved: false,
  outdated: false,
  threadId: seed.threadId,
});

const entryOf = ({
  sessionId,
  seed,
  index,
}: {
  readonly sessionId: SessionId;
  readonly seed: Seed;
  readonly index: number;
}): ResolveQueueItemWithThread => {
  const thread = buildThread({
    threadId: seed.threadId,
    state: seed.stage === 'asking' ? 'needs_answer' : seed.stage === 'proposed' ? 'fixed' : 'open',
    stage: seed.stage,
    revision: 1,
    activeAttemptId: null,
    disposition: seed.stage === 'proposed' ? 'fix' : null,
    replyDraft: seed.stage === 'proposed' ? 'Done.' : null,
    question: seed.stage === 'asking' ? 'Fail hard or return a warning?' : null,
    createdMinutesAgo: 30 - index,
  });
  const item = buildItem({
    id: `journey-item-${index}`,
    threadId: seed.threadId,
    approvalState: 'none',
    approvedRevision: null,
    deferredAt: null,
    deliveredAt: null,
    candidateRevision: 1,
    createdMinutesAgo: 30 - index,
  });
  return {
    item: { ...item, sessionId },
    thread: { ...thread, sessionId, prNumber: null, projectId: null },
  };
};

const writeQueue = ({
  sessionId,
  patch,
}: {
  readonly sessionId: SessionId;
  readonly patch: (entry: ResolveQueueItemWithThread) => ResolveQueueItemWithThread;
}): void => {
  const queue = useAppStore.getState().sessionResolveQueueItems[sessionId] ?? [];
  useAppStore.setState({
    sessionResolveQueueItems: { [sessionId]: queue.map(patch) },
    sessionResolveThreads: { [sessionId]: queue.map((entry) => patch(entry).thread) },
  });
};

const withDetail = ({
  github,
  comments,
}: {
  readonly github: SessionGithubState;
  readonly comments: ReadonlyArray<PrComment>;
}): SessionGithubState => ({
  ...github,
  detail: {
    ...(github.detail ?? { reviews: [], checks: [], reviewRequests: [] }),
    prNumber: github.pr?.number ?? 318,
    comments,
  },
  detailFetchedAt: STORY_NOW,
  detailLoading: false,
  detailError: null,
});

const PREVIEW: ResolvePublicationPreview = {
  publicationId: 'journey-publication',
  repo: 'harborline/payments-api',
  prNumber: 318,
  branch: 'hl/fix-duplicate-credit',
  localHead: 'a41c9e2aaaa',
  remoteHead: '7d02b11bbbb',
  requiresPush: true,
  frozenAt: 1,
  commits: [
    {
      sha: 'a41c9e2aaaa',
      shortSha: 'a41c9e2',
      subject: 'Fix the typo and redact the payload',
      author: 'resolver',
      timestamp: 1,
      pushed: false,
      parentSha: null,
      threadIds: ['PRRT_journey_typo', 'PRRT_journey_redact'],
    },
  ],
  unapproved: [],
  replies: [
    { threadId: 'PRRT_journey_typo', body: 'Done.', revision: 1, closes: true },
    { threadId: 'PRRT_journey_redact', body: 'Done.', revision: 1, closes: true },
  ],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
};

const BATCH: ResolveBatch = {
  id: 'journey-batch-1',
  sessionId: 'journey' as SessionId,
  threadIds: [],
  launchChoice: {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: null,
    commitStyle: null,
    hint: null,
  },
  createdAt: 1,
};

const installComments = ({
  sessionId,
  seeds,
}: {
  readonly sessionId: SessionId;
  readonly seeds: ReadonlyArray<Seed>;
}): void => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[sessionId]?.[0];
  const sessionGithub = state.sessionGithub[sessionId];
  const mountGithub = mount === undefined ? undefined : state.mountGithub[mount.mountId];
  if (mount === undefined || sessionGithub === undefined || mountGithub === undefined) {
    throw new Error('the pr seed has no mount pull request');
  }
  const comments = seeds.map((seed, index) => commentOf({ seed, index }));
  useAppStore.setState({
    sessionGithub: {
      ...state.sessionGithub,
      [sessionId]: withDetail({ github: sessionGithub, comments }),
    },
    mountGithub: {
      ...state.mountGithub,
      [mount.mountId]: { ...mountGithub, ...withDetail({ github: mountGithub, comments }) },
    },
    sessionResolveQueueItems: {
      [sessionId]: seeds.map((seed, index) => entryOf({ sessionId, seed, index })),
    },
    sessionResolveThreads: {
      [sessionId]: seeds.map((seed, index) => entryOf({ sessionId, seed, index }).thread),
    },
    sessionResolveAttempts: { [sessionId]: [] },
    loadResolveSession: async () => undefined,
    refreshReviewSource: async () => undefined,
    refreshThreadGitState: async () => undefined,
    acceptReviewComments: async ({ threadIds }) => {
      writeQueue({
        sessionId,
        patch: (entry) =>
          threadIds.includes(entry.thread.threadId)
            ? {
                item: { ...entry.item, approvalState: 'accepted', approvedRevision: 1 },
                thread: { ...entry.thread, state: 'fixed', stage: 'approved' },
              }
            : entry,
      });
      return { acceptedCount: threadIds.length, failures: [] };
    },
    preparePublication: async () => PREVIEW,
    publishConversations: async () => {
      writeQueue({
        sessionId,
        patch: (entry) =>
          entry.thread.stage === 'approved'
            ? {
                item: entry.item,
                thread: {
                  ...entry.thread,
                  state: 'failed',
                  stage: 'failed',
                  stateReason: `publication_failed:${PUBLISH_ERROR}`,
                },
              }
            : entry,
      });
      return {
        kind: 'done' as const,
        pushed: false,
        pushedHead: null,
        total: 2,
        replies: 0,
        replied: 0,
        closed: 0,
        resolved: 0,
        leftOpen: 0,
        failed: 2,
        error: 'rejected: the remote has newer commits',
      };
    },
  });
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const group = (name: string): HTMLElement => within(list()).getByRole('region', { name });

const nodeText = (node: HTMLElement): string => node.textContent ?? '';

const openComments = async (ctx: Ctx): Promise<void> => {
  await openCrumb(/^Branch/);
  await branchTab('comments')(ctx);
  await waitFor(() => expect(list()).toBeDefined(), WAIT);
};

const sidebarNeedsYou = (count: number): void => {
  expect(screen.getAllByText(new RegExp(`${count} need you`)).length).toBeGreaterThan(0);
};

export const COMMENTS_WORDS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'comments: accepting two reads two on the group, the banner, the Push button and the sidebar',
    covers: ['navigate'],
    open: async (ctx) => {
      installComments({ sessionId: ctx.sessionId, seeds: SEEDS });
      await openComments(ctx);
      expect(nodeText(group('Needs you'))).toContain('Needs you 3');
      sidebarNeedsYou(3);

      await click(within(group('Needs you')).getByRole('button', { name: 'Accept 2' }));
    },
    lands: async () => {
      await waitFor(
        () => expect(nodeText(group('Ready to push'))).toContain('Ready to push 2'),
        WAIT,
      );
      expect(nodeText(group('Needs you'))).toContain('Needs you 1');
      expect(screen.getAllByRole('button', { name: /^Push 2/ })).toHaveLength(2);
      sidebarNeedsYou(1);
    },
  },
  {
    name: "comments: a push that fails reads Push failed in Needs you, never Couldn't fix, and the session mark goes red",
    covers: ['navigate'],
    open: async (ctx) => {
      installComments({ sessionId: ctx.sessionId, seeds: SEEDS });
      await openComments(ctx);
      await click(within(group('Needs you')).getByRole('button', { name: 'Accept 2' }));
      const headerPush = screen
        .getAllByRole('button', { name: /^Push 2/ })
        .find((button) => !list().contains(button));
      if (headerPush === undefined) {
        throw new Error('the header has no Push button');
      }
      await click(headerPush);
      const confirm = await screen.findByRole('group', {
        name: 'Push 1 commit to hl/fix-duplicate-credit?',
      });
      await click(within(confirm).getByRole('button', { name: 'Push' }));
      await settle();
    },
    lands: async () => {
      await waitFor(
        () => expect(within(group('Needs you')).getAllByText('Push failed')).toHaveLength(2),
        WAIT,
      );
      expect(screen.queryByText("Couldn't fix")).toBeNull();
      expect(
        (await screen.findAllByLabelText(/2 comments didn't go out/, undefined, WAIT)).length,
      ).toBeGreaterThan(0);
    },
  },
  {
    name: 'comments: fixing three raises one Follow toast and Follow lands on the transcript drawer',
    covers: ['navigate'],
    open: async (ctx) => {
      installComments({ sessionId: ctx.sessionId, seeds: OPEN_SEEDS });
      const spawnAgent = vi.fn(async () => 'journey-agent-fix' as AgentId);
      useAppStore.setState({
        spawnAgent,
        createResolveBatch: async () => BATCH,
        setAgentConfig: async () => undefined,
      });
      await openComments(ctx);

      await click(await screen.findByRole('button', { name: 'Fix 3' }));
      const panel = await screen.findByRole('region', { name: 'Fix launch' }, WAIT);
      const note = within(panel).getByLabelText('Note for the fix run');
      await act(async () => {
        fireEvent.keyDown(note, { key: 'Enter', code: 'Enter', ctrlKey: true });
      });
      await settle();
    },
    lands: async (ctx) => {
      expect(await screen.findByText('Fix run started', undefined, WAIT)).toBeDefined();
      expect(screen.getByText(/^3 comments on /)).toBeDefined();
      const follow = screen.getAllByRole('button', { name: 'Follow' });
      expect(follow).toHaveLength(1);
      await clickButton('Follow');
      await waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('transcript'), WAIT);
      await branchTab('comments')(ctx);
    },
  },
];
