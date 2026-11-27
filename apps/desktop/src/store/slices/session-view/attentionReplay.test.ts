// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { aWorkflowRun } from '@goodboy/types/testing';
import {
  brandId,
  type ResolveThread,
  type SessionId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import {
  at,
  ledgerCore,
  openQuestionFor,
  paymentsApi,
} from '../../../features/workspace/testing/sessionColumn';
import { aDelegation, aView, FIXTURE_ROOT } from '../../../features/auto/testing/autoViewFixtures';
import { applyAgentTurnState } from '../sessions/sessionMutators';
import {
  REPLAY_HOSTS,
  REPLAY_RELEASE_ID,
  REPLAY_TIMES,
  replayAgent,
  replayErrorState,
  replayIdleState,
  replayRunningState,
  replaySessionOf,
  replayStageOf,
  seedReplayAgents,
  seedReplayRequests,
  seedReplaySession,
  type ReplayHost,
  type ReplayRequest,
} from './testing/attentionReplay.fixtures';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const sessionIn = ({ goal }: { readonly goal: string }) =>
  seedReplaySession({ store: useAppStore, session: replaySessionOf({ goal }) });

const stageOf = (session: ReturnType<typeof sessionIn>) =>
  replayStageOf({ store: useAppStore, session });

const turn = ({
  session,
  agent,
  state,
}: {
  readonly session: ReturnType<typeof sessionIn>;
  readonly agent: ReturnType<typeof replayAgent>;
  readonly state: Parameters<typeof applyAgentTurnState>[3];
}) => {
  applyAgentTurnState(
    (patch) => useAppStore.setState(patch),
    session.id,
    agent.id,
    state,
    at(REPLAY_TIMES.afterMerge),
  );
};

const failedAndHeld = ({ goal }: { readonly goal: string }) => {
  const session = sessionIn({ goal });
  const failed = replayAgent({
    session,
    slug: 'scout-ledger-core',
    status: 'failed',
    completedAt: REPLAY_TIMES.failed,
  });
  return { session, failed };
};

describe('replay: a failure stays while an unrelated agent finishes', () => {
  it('keeps agent-error when a later unrelated agent completes', () => {
    const { session, failed } = failedAndHeld({ goal: 'Retry webhooks' });
    const other = replayAgent({
      session,
      slug: 'scout-notify-relay',
      status: 'completed',
      completedAt: REPLAY_TIMES.afterMerge,
    });
    seedReplayAgents({ store: useAppStore, session, agents: [failed, other] });

    turn({ session, agent: failed, state: replayErrorState() });
    turn({ session, agent: other, state: replayIdleState() });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  it('keeps agent-error when the unrelated agent finished first and the failure came after', () => {
    const { session, failed } = failedAndHeld({ goal: 'Retry webhooks' });
    const other = replayAgent({
      session,
      slug: 'scout-notify-relay',
      status: 'completed',
      completedAt: REPLAY_TIMES.earlier,
    });
    seedReplayAgents({ store: useAppStore, session, agents: [other, failed] });

    turn({ session, agent: other, state: replayIdleState() });
    turn({ session, agent: failed, state: replayErrorState() });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  it('keeps agent-error while a third agent runs and the second one completes', () => {
    const { session, failed } = failedAndHeld({ goal: 'Retry webhooks' });
    const done = replayAgent({ session, slug: 'verify', status: 'completed' });
    const running = replayAgent({ session, slug: 'implement', status: 'running' });
    seedReplayAgents({ store: useAppStore, session, agents: [failed, done, running] });

    turn({ session, agent: failed, state: replayErrorState() });
    turn({ session, agent: done, state: replayIdleState() });

    expect(stageOf(session).attention).toBe('agent-error');
  });
});

describe('replay: a restart seeds every agent but the failed one idle', () => {
  type BootParams = {
    readonly agentsOf: (session: ReturnType<typeof sessionIn>) => ReturnType<typeof replayAgent>[];
  };

  const bootFrom = async ({ agentsOf }: BootParams) => {
    const session = replaySessionOf({ goal: 'Retry webhooks' });
    const persisted = {
      ...session,
      state: replayErrorState(),
    };
    seedReplaySession({ store: useAppStore, session: persisted });
    useAppStore.setState({ currentSessionId: null });
    storySpies.invokeAgentList.mockResolvedValue(agentsOf(persisted));
    await useAppStore.getState().setCurrentSession(persisted.id);
    return persisted;
  };

  it('keeps agent-error when a pending agent follows the failed one', async () => {
    const session = await bootFrom({
      agentsOf: (booted) => [
        replayAgent({
          session: booted,
          slug: 'implement',
          status: 'failed',
          completedAt: REPLAY_TIMES.failed,
        }),
        replayAgent({ session: booted, slug: 'verify', status: 'pending' }),
      ],
    });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  it('keeps agent-error when a skipped agent follows the failed one', async () => {
    const session = await bootFrom({
      agentsOf: (booted) => [
        replayAgent({
          session: booted,
          slug: 'implement',
          status: 'failed',
          completedAt: REPLAY_TIMES.failed,
        }),
        replayAgent({ session: booted, slug: 'verify', status: 'skipped' }),
      ],
    });

    expect(stageOf(session).attention).toBe('agent-error');
  });

  it('keeps agent-error when the only agent that completed did so before the failure', async () => {
    const session = await bootFrom({
      agentsOf: (booted) => [
        replayAgent({
          session: booted,
          slug: 'plan',
          status: 'completed',
          completedAt: REPLAY_TIMES.earlier,
        }),
        replayAgent({
          session: booted,
          slug: 'implement',
          status: 'failed',
          completedAt: REPLAY_TIMES.failed,
        }),
      ],
    });

    expect(stageOf(session).attention).toBe('agent-error');
  });

  it('keeps agent-error when a blocked agent follows the failed one', async () => {
    const session = await bootFrom({
      agentsOf: (booted) => [
        replayAgent({
          session: booted,
          slug: 'implement',
          status: 'failed',
          completedAt: REPLAY_TIMES.failed,
        }),
        replayAgent({ session: booted, slug: 'verify', status: 'blocked' }),
      ],
    });

    expect(stageOf(session).attention).toBe('agent-error');
  });
});

describe('replay: a session with no settled request is never settled', () => {
  type Scene = {
    readonly name: string;
    readonly requests: ReadonlyArray<ReplayRequest>;
  };

  const SCENES: ReadonlyArray<Scene> = [
    { name: 'no request at all', requests: [] },
    {
      name: 'a mount whose request was fetched and does not exist',
      requests: [{ host: 'github', project: paymentsApi, state: null }],
    },
    {
      name: 'a request that was never fetched',
      requests: [{ host: 'github', project: paymentsApi, state: null, fetch: 'never' }],
    },
    {
      name: 'a request whose fetch failed',
      requests: [{ host: 'github', project: paymentsApi, state: null, fetch: 'failed' }],
    },
    {
      name: 'a GitLab request whose fetch failed',
      requests: [{ host: 'gitlab', project: paymentsApi, state: null, fetch: 'failed' }],
    },
    {
      name: 'a Bitbucket request whose fetch failed',
      requests: [{ host: 'bitbucket', project: paymentsApi, state: null, fetch: 'failed' }],
    },
    {
      name: 'a GitLab request that was never fetched',
      requests: [{ host: 'gitlab', project: paymentsApi, state: null, fetch: 'never' }],
    },
    {
      name: 'a Bitbucket request that was never fetched',
      requests: [{ host: 'bitbucket', project: paymentsApi, state: null, fetch: 'never' }],
    },
    {
      name: 'one merged request and one open request',
      requests: [
        { host: 'github', project: paymentsApi, state: 'merged', number: 301 },
        { host: 'github', project: ledgerCore, state: 'open', number: 302 },
      ],
    },
    {
      name: 'a merged request and a mount with no request yet',
      requests: [
        { host: 'github', project: paymentsApi, state: 'merged', number: 301 },
        { host: 'github', project: ledgerCore, state: null },
      ],
    },
    {
      name: 'two mounts on two hosts, one merged and one still live',
      requests: [
        { host: 'gitlab', project: paymentsApi, state: 'merged', number: 311 },
        { host: 'bitbucket', project: ledgerCore, state: 'open', number: 312 },
      ],
    },
  ];

  it.each(SCENES)('keeps the failure with $name', ({ requests }) => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayAgents({
      store: useAppStore,
      session,
      agents: [replayAgent({ session, slug: 'implement', status: 'failed' })],
    });
    turn({
      session,
      agent: replayAgent({ session, slug: 'implement', status: 'failed' }),
      state: replayErrorState(),
    });
    seedReplayRequests({ store: useAppStore, session, requests });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  it.each(SCENES)('never reads as done with $name', ({ requests }) => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayRequests({ store: useAppStore, session, requests });

    expect(stageOf(session).stage).not.toBe('done');
  });

  it('keeps an open question with a merged request and an open one on another mount', () => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayRequests({
      store: useAppStore,
      session,
      requests: [
        { host: 'github', project: paymentsApi, state: 'merged', number: 301 },
        { host: 'github', project: ledgerCore, state: 'open', number: 302 },
      ],
    });
    useAppStore.setState({
      sessionOpenQuestions: {
        [session.id]: [openQuestionFor({ sessionId: session.id })],
      },
    });

    expect(stageOf(session)).toMatchObject({ attention: 'open-question' });
  });
});

describe('replay: what happens after the merge stays visible, on every host', () => {
  type HostScene = {
    readonly host: ReplayHost;
  };

  const hosts = REPLAY_HOSTS.map((host): HostScene => ({ host }));

  const merged = ({ host }: HostScene): ReadonlyArray<ReplayRequest> => [
    { host, project: paymentsApi, state: 'merged', number: 301 },
  ];

  it.each(hosts)('keeps a failure that lands after the $host merge', ({ host }) => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayRequests({ store: useAppStore, session, requests: merged({ host }) });
    const failed = replayAgent({
      session,
      slug: 'summarize',
      status: 'failed',
      completedAt: REPLAY_TIMES.afterMerge,
    });
    seedReplayAgents({ store: useAppStore, session, agents: [failed] });

    turn({
      session,
      agent: failed,
      state: replayErrorState({ failedAt: REPLAY_TIMES.afterMerge }),
    });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  it.each(hosts)('keeps an unread reply that lands after the $host merge', ({ host }) => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayRequests({ store: useAppStore, session, requests: merged({ host }) });
    seedReplayAgents({
      store: useAppStore,
      session,
      agents: [
        replayAgent({
          session,
          slug: 'answer',
          status: 'completed',
          completedAt: REPLAY_TIMES.afterMerge,
          overrides: { lastFinishedAt: at(REPLAY_TIMES.afterMerge) },
        }),
      ],
    });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'unread-reply' });
  });

  it.each(hosts)('keeps an agent that starts after the $host merge as running', ({ host }) => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayRequests({ store: useAppStore, session, requests: merged({ host }) });
    const running = replayAgent({
      session,
      slug: 'follow-up',
      status: 'running',
      startedAt: REPLAY_TIMES.afterMerge,
    });
    seedReplayAgents({ store: useAppStore, session, agents: [running] });

    turn({
      session,
      agent: running,
      state: replayRunningState({ startedAt: REPLAY_TIMES.afterMerge }),
    });

    expect(stageOf(session)).toMatchObject({ stage: 'running', isRunning: true });
  });
});

describe('replay: review work on a merged branch stays in needs you', () => {
  const threadOf = ({
    session,
    slug,
    overrides,
  }: {
    readonly session: ReturnType<typeof sessionIn>;
    readonly slug: string;
    readonly overrides: Partial<ResolveThread>;
  }): ResolveThread => ({
    id: `thread-replay-${slug}`,
    sessionId: session.id,
    projectId: paymentsApi.id,
    prNumber: 301,
    threadId: `provider-thread-${slug}`,
    originKind: 'review_comment',
    diffCommentId: null,
    state: 'needs_answer',
    stage: 'asking',
    stateReason: null,
    revision: 1,
    generation: 1,
    reopenedFromThreadId: null,
    activeAttemptId: null,
    disposition: null,
    replyDraft: null,
    commitShas: null,
    fixupOfSha: null,
    replacesSha: null,
    question: null,
    replyPostedAt: null,
    replyId: null,
    githubResolved: null,
    closedAt: null,
    closedSource: null,
    createdAt: Date.parse(REPLAY_TIMES.merged),
    updatedAt: Date.parse(REPLAY_TIMES.merged),
    ...overrides,
  });

  const mergedHere = ({ host }: { readonly host: ReplayHost }) => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayRequests({
      store: useAppStore,
      session,
      requests: [{ host, project: paymentsApi, state: 'merged', number: 301 }],
    });
    return session;
  };

  it.each(REPLAY_HOSTS)(
    'keeps fix-needs-you for an open review thread after a %s merge',
    (host) => {
      const session = mergedHere({ host });
      useAppStore.setState({
        sessionResolveThreads: {
          [session.id]: [threadOf({ session, slug: 'open', overrides: { state: 'needs_answer' } })],
        },
      });

      expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'fix-needs-you' });
    },
  );

  it.each(REPLAY_HOSTS)(
    'keeps push-failed for a reply that did not go out after a %s merge',
    (host) => {
      const session = mergedHere({ host });
      useAppStore.setState({
        sessionResolveThreads: {
          [session.id]: [
            threadOf({
              session,
              slug: 'push',
              overrides: { state: 'failed', stateReason: 'publication_failed:rejected' },
            }),
          ],
        },
      });

      expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'push-failed' });
    },
  );

  it('lists both a thread that needs you and a push that failed on the merged branch', () => {
    const session = mergedHere({ host: 'github' });
    useAppStore.setState({
      sessionResolveThreads: {
        [session.id]: [
          threadOf({ session, slug: 'open', overrides: { state: 'needs_answer' } }),
          threadOf({
            session,
            slug: 'push',
            overrides: { state: 'failed', stateReason: 'publication_failed:rejected' },
          }),
        ],
      },
    });

    const info = stageOf(session);

    expect([info.attention, ...(info.otherReasons ?? [])].sort()).toEqual([
      'fix-needs-you',
      'push-failed',
    ]);
  });
});

describe('replay: Leads and runs keep what has not been replaced or cleared', () => {
  const leadRoot = ({ session }: { readonly session: ReturnType<typeof sessionIn> }) =>
    replayAgent({
      session,
      slug: 'lead',
      status: 'completed',
      overrides: { id: FIXTURE_ROOT, kind: 'auto' },
    });

  it('keeps a blocked Lead that no later delegation replaced', () => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayAgents({ store: useAppStore, session, agents: [leadRoot({ session })] });
    useAppStore.setState({
      autoTreeViews: {
        [session.id]: [
          aView({
            phase: 'blocked',
            delegations: [
              aDelegation({
                key: 'implementer',
                role: 'implementer',
                state: 'settled',
                outcome: 'blocked',
              }),
            ],
          }),
        ],
      },
    });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  it('keeps a blocked Lead when a delegation of another role completes after it', () => {
    const session = sessionIn({ goal: 'Retry webhooks' });
    seedReplayAgents({ store: useAppStore, session, agents: [leadRoot({ session })] });
    useAppStore.setState({
      autoTreeViews: {
        [session.id]: [
          aView({
            phase: 'blocked',
            delegations: [
              aDelegation({
                key: 'implementer',
                role: 'implementer',
                state: 'settled',
                outcome: 'blocked',
                settledAt: 1,
              }),
              aDelegation({
                key: 'reviewer',
                role: 'reviewer',
                state: 'settled',
                outcome: 'completed',
                batch: 'batch-2',
                settledAt: 2,
              }),
            ],
          }),
        ],
      },
    });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'agent-error' });
  });

  const runOf = ({
    id,
    overrides,
  }: {
    readonly id: string;
    readonly overrides: Partial<WorkflowRun>;
  }): WorkflowRun =>
    aWorkflowRun({
      id: brandId<WorkflowRunId>({ value: id }),
      workflowId: REPLAY_RELEASE_ID,
      executionMode: 'dynamic',
      ...overrides,
    });

  it('keeps run-stopped on a run that has a stop while another run of the session succeeds', () => {
    const session = sessionIn({ goal: 'Roll out the Northwind release' });
    const stopped = runOf({
      id: 'run-stopped',
      overrides: { orchestrationStop: { kind: 'failure', message: 'The orchestrator failed.' } },
    });
    const finished = runOf({
      id: 'run-finished',
      overrides: { orchestrationOutcome: 'done', ordinal: 1 },
    });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((candidate) =>
        candidate.id === session.id
          ? { ...candidate, workflowRuns: [stopped, finished] }
          : candidate,
      ),
    }));
    seedReplayAgents({
      store: useAppStore,
      session,
      agents: [
        replayAgent({
          session,
          slug: 'later-step',
          status: 'completed',
          completedAt: REPLAY_TIMES.afterMerge,
          overrides: { workflowRunId: finished.id },
        }),
      ],
    });

    expect(stageOf(session)).toMatchObject({ stage: 'attention', attention: 'run-stopped' });
  });
});
