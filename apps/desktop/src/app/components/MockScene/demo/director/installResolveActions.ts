import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type ResolveAttempt,
  type ResolveQueueItemWithThread,
  type SessionId,
} from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { ReportedError } from '../../../../../store/slices/notifications/reportedError';
import type { DirectorStore } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { resolveFixCues } from './resolveFixCues';
import { scheduleCues } from './scheduleCues';
import { demoRuns } from './demoRunRegistry';
import { showDemoNotice } from './showDemoNotice';
import { startAgentTurn } from './startAgentTurn';
import { finishAgentTurn } from './finishAgentTurn';
import { patchAgent } from './patchAgent';
import { patchResolveThreads } from './patchResolveThreads';
import { installDemoWorld } from './installDemoWorld';
import { STORY_FIX_DIFF } from './resolveStory';
import { addDemoOverlay } from './addDemoOverlay';
import { demoPublicationPreview } from './demoPublicationPreview';

const PUBLISH_NOTICE =
  'Publishing posts the reply on your pull request in the app. Here the reply stays drafted, ready to publish.';

type Params = {
  readonly store: DirectorStore;
};

type SpawnParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly name: string;
  readonly prompt: string;
};

type AttemptParams = {
  readonly base: ResolveAttempt | undefined;
  readonly agentId: AgentId;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

const attemptOf = ({ base, agentId, sessionId, threadIds }: AttemptParams): ResolveAttempt => {
  const now = Date.now();
  return {
    ...(base ?? {
      prNumber: null,
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      instructions: null,
      mountTarget: null,
      error: null,
      batchId: null,
      copyPath: null,
      launchChoice: null,
      launchId: null,
    }),
    id: `demo-attempt-${agentId}`,
    launchId: `demo-launch-${agentId}`,
    sessionId,
    agentId,
    threadIds,
    phase: 'running',
    startedAt: now,
    endedAt: null,
    error: null,
    createdAt: now,
  };
};

type StopParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const stopFix = ({ store, sessionId, agentId }: StopParams): void => {
  demoRuns.stop({ agentId });
  const attempts = (store.getState().sessionResolveAttempts[sessionId] ?? []).filter(
    (attempt) => attempt.agentId === agentId && attempt.phase === 'running',
  );
  const ids = new Set(attempts.map((attempt) => attempt.id));
  const threadIds = attempts.flatMap((attempt) => attempt.threadIds);
  const at = nowIso({});
  store.setState((current) => ({
    sessionResolveAttempts: {
      ...current.sessionResolveAttempts,
      [sessionId]: (current.sessionResolveAttempts[sessionId] ?? []).map((attempt) =>
        ids.has(attempt.id) ? { ...attempt, phase: 'cancelled', endedAt: Date.now() } : attempt,
      ),
    },
  }));
  patchResolveThreads({
    store,
    sessionId,
    threadIds,
    patch: ({ thread }) => ({
      ...thread,
      state: 'open',
      stage: 'new',
      activeAttemptId: null,
      updatedAt: Date.now(),
    }),
  });
  finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
  patchAgent({ store, sessionId, agentId, patch: { status: 'skipped' } });
};

const spawnResolver = ({ store, sessionId, threadIds, name, prompt }: SpawnParams): AgentId => {
  const agentId = brandId<AgentId>({ value: `demo-resolver-${crypto.randomUUID()}` });
  const runId = brandId<ProviderRunId>({ value: `${agentId}-run` });
  const at = nowIso({});
  const state = store.getState();
  const ordinal = (state.sessionPhaseRuns[sessionId] ?? []).length + 1;
  const agent: Agent = {
    id: agentId,
    sessionId,
    ordinal,
    name,
    kind: 'resolver',
    status: 'running',
    runId,
    startedAt: at,
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5-5',
  };
  const attempt = attemptOf({
    base: state.sessionResolveAttempts[sessionId]?.[0],
    agentId,
    sessionId,
    threadIds,
  });
  store.setState((current) => ({
    sessionPhaseRuns: {
      ...current.sessionPhaseRuns,
      [sessionId]: [...(current.sessionPhaseRuns[sessionId] ?? []), agent],
    },
    sessionResolveAttempts: {
      ...current.sessionResolveAttempts,
      [sessionId]: [...(current.sessionResolveAttempts[sessionId] ?? []), attempt],
    },
    agentRunHistory: { ...current.agentRunHistory, [agentId]: [runId] },
  }));
  patchResolveThreads({
    store,
    sessionId,
    threadIds,
    patch: ({ thread }) => ({
      ...thread,
      state: 'working',
      stage: 'working',
      activeAttemptId: attempt.id,
      updatedAt: Date.now(),
    }),
  });
  appendTurnEvents({ store, agentId, events: [{ kind: 'user_text', runId, text: prompt, at }] });
  startAgentTurn({ store, sessionId, agentId, runId, at });
  scheduleCues({
    store,
    cues: resolveFixCues({ sessionId, agentId, runId, attemptId: attempt.id, threadIds }),
    now: () => nowIso({}),
    agentId,
  });
  return agentId;
};

const refusePublish = (): never => {
  showDemoNotice({ message: PUBLISH_NOTICE });
  throw new ReportedError(PUBLISH_NOTICE);
};

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
};

type PatchItemParams = {
  readonly sessionId: SessionId;
  readonly itemId: string;
  readonly change: (params: EntryParams) => ResolveQueueItemWithThread;
};

const RESOLVE_ANSWERS: Readonly<Record<string, unknown>> = {
  worktree_diff: STORY_FIX_DIFF,
  worktree_diff_range: STORY_FIX_DIFF,
};

export const installResolveActions = ({ store }: Params): void => {
  installDemoWorld({ store });
  addDemoOverlay({ answers: RESOLVE_ANSWERS });
  const simulatedSpawn = store.getState().spawnAgent;
  const spawnAgent = (async (sessionId, options) => {
    if (options?.kindOverride !== 'resolver') {
      return simulatedSpawn(sessionId, options);
    }
    return spawnResolver({
      store,
      sessionId,
      threadIds: options.sourceThreadIds ?? [],
      name: options.name ?? 'Resolve a review comment',
      prompt: options.humanPrompt ?? options.initialPrompt ?? 'Fix this review comment.',
    });
  }) satisfies AppStore['spawnAgent'];
  const createResolveBatch: AppStore['createResolveBatch'] = async ({
    sessionId,
    threadIds,
    launchChoice,
  }) => {
    const batch = {
      id: `demo-batch-${crypto.randomUUID()}`,
      sessionId,
      threadIds,
      launchChoice,
      createdAt: Date.now(),
    };
    store.setState((current) => ({
      sessionResolveBatches: {
        ...current.sessionResolveBatches,
        [sessionId]: [...(current.sessionResolveBatches[sessionId] ?? []), batch],
      },
    }));
    return batch;
  };
  const setAgentConfig: AppStore['setAgentConfig'] = async () => undefined;
  const acceptReviewComments: AppStore['acceptReviewComments'] = async ({
    sessionId,
    threadIds,
  }) => {
    const wanted = new Set(threadIds);
    store.setState((current) => ({
      sessionResolveQueueItems: {
        ...current.sessionResolveQueueItems,
        [sessionId]: (current.sessionResolveQueueItems[sessionId] ?? []).map((entry) =>
          wanted.has(entry.thread.threadId)
            ? {
                item: {
                  ...entry.item,
                  approvalState: 'accepted',
                  approvedRevision: entry.item.candidateRevision,
                },
                thread: { ...entry.thread, state: 'fixed', stage: 'approved' },
              }
            : entry,
        ),
      },
    }));
    return { acceptedCount: threadIds.length, failures: [] };
  };
  const patchItem = ({ sessionId, itemId, change }: PatchItemParams): void => {
    store.setState((current) => ({
      sessionResolveQueueItems: {
        ...current.sessionResolveQueueItems,
        [sessionId]: (current.sessionResolveQueueItems[sessionId] ?? []).map((entry) =>
          entry.item.id === itemId ? change({ entry }) : entry,
        ),
      },
    }));
  };
  const acceptResolveQueueItem: AppStore['acceptResolveQueueItem'] = async ({
    sessionId,
    itemId,
    revision,
    reply,
  }) => {
    patchItem({
      sessionId,
      itemId,
      change: ({ entry }) => ({
        item: { ...entry.item, approvalState: 'accepted', approvedRevision: revision },
        thread: {
          ...entry.thread,
          state: 'fixed',
          stage: 'approved',
          replyDraft: reply === '' ? entry.thread.replyDraft : reply,
        },
      }),
    });
  };
  const reopenResolveQueueItem: AppStore['reopenResolveQueueItem'] = async ({
    sessionId,
    itemId,
  }) => {
    patchItem({
      sessionId,
      itemId,
      change: ({ entry }) => ({
        item: { ...entry.item, approvalState: 'none', approvedRevision: null },
        thread: { ...entry.thread, stage: 'proposed' },
      }),
    });
  };
  const deferResolveQueueItem: AppStore['deferResolveQueueItem'] = async ({
    sessionId,
    itemId,
  }) => {
    patchItem({
      sessionId,
      itemId,
      change: ({ entry }) => ({
        ...entry,
        item: { ...entry.item, approvalState: 'deferred', deferredAt: Date.now() },
      }),
    });
  };
  const takeUpResolveQueueItem: AppStore['takeUpResolveQueueItem'] = async ({
    sessionId,
    itemId,
  }) => {
    patchItem({
      sessionId,
      itemId,
      change: ({ entry }) => ({
        ...entry,
        item: { ...entry.item, approvalState: 'none', deferredAt: null },
      }),
    });
  };
  const forceCloseResolver = (async (sessionId, agentId) => {
    stopFix({ store, sessionId, agentId });
  }) satisfies AppStore['forceCloseResolver'];
  const stopResolveLane: AppStore['stopResolveLane'] = async ({ sessionId }) => {
    const running = (store.getState().sessionResolveAttempts[sessionId] ?? []).filter(
      (attempt) => attempt.phase === 'running',
    );
    for (const attempt of running) {
      stopFix({ store, sessionId, agentId: attempt.agentId });
    }
  };
  const settleResolveSourceChange: AppStore['settleResolveSourceChange'] = async ({
    sessionId,
    threadId,
  }) => {
    store.setState((current) => {
      const snapshots = current.sessionResolveSourceSnapshots[sessionId] ?? {};
      const snapshot = snapshots[threadId];
      if (snapshot === undefined || snapshot.changed === null) {
        return {};
      }
      return {
        sessionResolveSourceSnapshots: {
          ...current.sessionResolveSourceSnapshots,
          [sessionId]: {
            ...snapshots,
            [threadId]: { ...snapshot.changed, replyIds: snapshot.replyIds, changed: null },
          },
        },
      };
    });
  };
  const publishConversations: AppStore['publishConversations'] = async ({ sessionId }) => {
    const now = Date.now();
    const accepted = (store.getState().sessionResolveQueueItems[sessionId] ?? []).filter(
      (entry) => entry.item.approvalState === 'accepted' && entry.item.deliveredAt === null,
    );
    const acceptedIds = new Set(accepted.map((entry) => entry.item.id));
    const threadIds = accepted.map((entry) => entry.thread.threadId);
    patchResolveThreads({
      store,
      sessionId,
      threadIds,
      patch: ({ thread }) => ({
        ...thread,
        state: 'closed',
        stage: 'resolved',
        replyPostedAt: now,
        closedAt: now,
        closedSource: 'goodboy',
        updatedAt: now,
      }),
    });
    store.setState((current) => ({
      sessionResolveQueueItems: {
        ...current.sessionResolveQueueItems,
        [sessionId]: (current.sessionResolveQueueItems[sessionId] ?? []).map((entry) =>
          acceptedIds.has(entry.item.id)
            ? { ...entry, item: { ...entry.item, deliveredAt: now, updatedAt: now } }
            : entry,
        ),
      },
    }));
    const total = accepted.length;
    return {
      kind: 'done',
      pushed: true,
      pushedHead: null,
      total,
      replies: total,
      replied: total,
      closed: total,
      resolved: total,
      leftOpen: 0,
      failed: 0,
      error: null,
    };
  };
  const preparePublication: AppStore['preparePublication'] = async ({ sessionId, threadIds }) => {
    const preview = demoPublicationPreview({ state: store.getState(), sessionId, threadIds });
    store.setState((current) => ({
      activePublicationPreview: { ...current.activePublicationPreview, [sessionId]: preview },
    }));
    return preview;
  };
  const cancelPublication: AppStore['cancelPublication'] = async ({ sessionId }) => {
    store.setState((current) => ({
      activePublicationPreview: { ...current.activePublicationPreview, [sessionId]: null },
    }));
  };
  store.setState({
    preparePublication,
    cancelPublication,
    forceCloseResolver,
    stopResolveLane,
    acceptResolveQueueItem,
    reopenResolveQueueItem,
    deferResolveQueueItem,
    takeUpResolveQueueItem,
    settleResolveSourceChange,
    spawnAgent,
    createResolveBatch,
    setAgentConfig,
    acceptReviewComments,
    publishThreadNow: async () => refusePublish(),
    replyAndResolveThread: async () => refusePublish(),
    publishConversations,
    retryPublication: async () => refusePublish(),
  });
};
