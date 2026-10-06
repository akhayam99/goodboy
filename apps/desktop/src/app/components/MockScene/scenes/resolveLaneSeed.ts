import type {
  Agent,
  AgentId,
  ResolveAttempt,
  ResolveCandidate,
  ResolveQueueItemWithThread,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolveCandidateWithItems } from '../../../../store/slices/resolve/state';
import { MOUNT_TARGET, QUEUE_ITEMS, SESSION_ID, THREAD_IDS, msAgo } from './resolveSeed';

export type ResolveLaneVariant = 'working' | 'chain';

const BATCH_ID = 'mock-resolve-batch-lane';
const FIRST_THREAD = 'PRRT_thread_retry_backoff';
const SECOND_THREAD = THREAD_IDS.metrics;
const THIRD_THREAD = THREAD_IDS.retryConstant;
const LANE_ATTEMPT_THREADS: ReadonlyArray<string> = [
  THREAD_IDS.idempotency,
  THREAD_IDS.typo,
  THREAD_IDS.retryConstant,
];
const ATTEMPT_ID_PREFIX = 'mock-resolve-attempt-lane';

const entryOf = ({ threadId }: { readonly threadId: string }): ResolveQueueItemWithThread => {
  const found = QUEUE_ITEMS.find((entry) => entry.thread.threadId === threadId);
  if (found === undefined) {
    throw new Error(`no seed for ${threadId}`);
  }
  return found;
};

const laneAgent = ({
  index,
  status,
}: {
  readonly index: number;
  readonly status: 'running' | 'pending';
}): Agent =>
  ({
    id: `mock-resolve-agent-lane-${index}` as AgentId,
    sessionId: SESSION_ID,
    ordinal: 60 + index,
    name: `Resolve: comment ${index + 1}`,
    kind: 'resolver',
    status,
    startedAt: new Date(msAgo({ minutes: 4 })).toISOString(),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5',
  }) as Agent;

const laneAttempt = ({
  index,
  threadId,
  phase,
}: {
  readonly index: number;
  readonly threadId: string;
  readonly phase: 'running' | 'queued';
}): ResolveAttempt => ({
  id: `${ATTEMPT_ID_PREFIX}-${index}`,
  sessionId: SESSION_ID,
  agentId: `mock-resolve-agent-lane-${index}` as AgentId,
  prNumber: 318,
  threadIds: [threadId],
  launchId: `${BATCH_ID}-launch`,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'medium',
  instructions: null,
  phase,
  mountTarget: MOUNT_TARGET,
  startedAt: phase === 'running' ? msAgo({ minutes: 4 }) : null,
  endedAt: null,
  error: null,
  createdAt: msAgo({ minutes: 5 - index }),
  batchId: BATCH_ID,
  copyPath: null,
  launchChoice: null,
});

const workingQueue = (): ReadonlyArray<ResolveQueueItemWithThread> =>
  useAppStore.getState().sessionResolveQueueItems[SESSION_ID]?.map((entry) => {
    const index = LANE_ATTEMPT_THREADS.indexOf(entry.thread.threadId);
    if (index < 0) {
      return entry;
    }
    return {
      item: { ...entry.item, approvalState: 'none' as const, deferredAt: null },
      thread: {
        ...entry.thread,
        state: 'working' as const,
        stage: 'working' as const,
        activeAttemptId: `${ATTEMPT_ID_PREFIX}-${index}`,
        disposition: null,
        replyDraft: null,
      },
    };
  }) ?? [];

const candidateOf = ({
  index,
  baseSha,
  candidateSha,
}: {
  readonly index: number;
  readonly baseSha: string;
  readonly candidateSha: string;
}): ResolveCandidate => ({
  id: `mock-resolve-candidate-lane-${index}`,
  sessionId: SESSION_ID,
  revision: index + 1,
  baseSha,
  candidateSha,
  worktreePath: MOUNT_TARGET.worktreePath,
  mountTarget: MOUNT_TARGET,
  state: 'ready',
  integratedSha: null,
  createdAt: msAgo({ minutes: 30 - index }),
  updatedAt: msAgo({ minutes: 30 - index }),
});

const chainQueue = (): ReadonlyArray<ResolveQueueItemWithThread> =>
  useAppStore.getState().sessionResolveQueueItems[SESSION_ID]?.map((entry) =>
    entry.thread.threadId === THIRD_THREAD
      ? {
          item: { ...entry.item, candidateRevision: 1 },
          thread: {
            ...entry.thread,
            state: 'fixed' as const,
            stage: 'proposed' as const,
            disposition: 'fix' as const,
            replyDraft: 'Named the constant and moved it next to the cap.',
            revision: 1,
          },
        }
      : entry,
  ) ?? [];

const chainCandidates = (): ReadonlyArray<ResolveCandidateWithItems> => {
  const shas = [
    'c81f4a20d95e73b6f10c8a4d29e75b3f60c19d84',
    'e37b92c05a1f8d4e6b27c90a3f5d81e402b7c96a',
    '5d0a6f1c82b34e97a0d1c5f6e8b2a47193c0d5e2',
    '9b1c3e7a40d2f685b13a7e9c0d4f2b6a85e1c730',
  ];
  return [FIRST_THREAD, SECOND_THREAD, THIRD_THREAD].map((threadId, index) => {
    const entry = entryOf({ threadId });
    const candidate = candidateOf({
      index,
      baseSha: shas[index] ?? '',
      candidateSha: shas[index + 1] ?? '',
    });
    return {
      candidate,
      items: [
        {
          candidateId: candidate.id,
          queueItemId: entry.item.id,
          itemRevision: entry.item.candidateRevision,
        },
      ],
    };
  });
};

export const applyResolveLaneSeed = ({
  variant,
}: {
  readonly variant: ResolveLaneVariant;
}): void => {
  if (variant === 'chain') {
    useAppStore.setState({
      sessionResolveQueueItems: { [SESSION_ID]: chainQueue() },
      sessionResolveCandidates: { [SESSION_ID]: chainCandidates() },
    });
    return;
  }
  const attempts = (useAppStore.getState().sessionResolveAttempts[SESSION_ID] ?? []).filter(
    (attempt) => !attempt.threadIds.some((threadId) => LANE_ATTEMPT_THREADS.includes(threadId)),
  );
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: workingQueue() },
    sessionResolveAttempts: {
      [SESSION_ID]: [
        ...attempts,
        ...LANE_ATTEMPT_THREADS.map((threadId, index) =>
          laneAttempt({ index, threadId, phase: index === 0 ? 'running' : 'queued' }),
        ),
      ],
    },
    sessionPhaseRuns: {
      [SESSION_ID]: LANE_ATTEMPT_THREADS.map((_, index) =>
        laneAgent({ index, status: index === 0 ? 'running' : 'pending' }),
      ),
    },
  });
};
