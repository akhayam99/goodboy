import {
  brandId,
  type Agent,
  type AgentId,
  type ResolveAttempt,
  type ResolveQueueItemWithThread,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION_ID } from '../resolveSeed';
import { seedBulkScene } from '../bulkSeed';

const clock = sceneClock({ anchor: '2026-10-28T09:40:00.000Z' });

export type ResolveStateVariant = 'working' | 'ready' | 'skipped' | 'failed';

type Params = {
  readonly variant: ResolveStateVariant;
};

const AGENT_ID = brandId<AgentId>({ value: 'mock-bulk-agent' });
const KEYS: ReadonlyArray<string> = ['r1', 'r2', 'r3', 'r4'];
const FIX_SHA = '90b1d57f1c4e8a2b6d03f5a79c1e4b8d2a6f0c35';
const SUMMARY_READY =
  'Committed as 90b1d57. The four threads were one change, so they share that commit.';
const SUMMARY_SKIPPED = `${SUMMARY_READY} eslint and tsc didn't run because deps aren't installed in this copy, so the change is checked only by prettier and grep.`;

type KeyParams = {
  readonly key: string;
};

const threadOf = ({ key }: KeyParams): string => `PRRT_bulk_${key}`;

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
  readonly index: number;
  readonly variant: ResolveStateVariant;
};

const entryOf = ({ entry, index, variant }: EntryParams): ResolveQueueItemWithThread => {
  if (variant === 'working') {
    return {
      item: entry.item,
      thread: {
        ...entry.thread,
        state: 'working',
        stage: 'working',
        disposition: null,
        replyDraft: null,
        commitShas: null,
      },
    };
  }
  if (variant === 'failed' && index >= 2) {
    return {
      item: entry.item,
      thread: {
        ...entry.thread,
        state: 'failed',
        stage: 'failed',
        stateReason: null,
        disposition: null,
        replyDraft: null,
        commitShas: null,
      },
    };
  }
  return { item: entry.item, thread: { ...entry.thread, commitShas: [FIX_SHA] } };
};

type AttemptParams = {
  readonly attempt: ResolveAttempt;
  readonly variant: ResolveStateVariant;
};

const attemptOf = ({ attempt, variant }: AttemptParams): ResolveAttempt => ({
  ...attempt,
  threadIds: KEYS.map((key) => threadOf({ key })),
  phase: variant === 'working' ? 'running' : variant === 'failed' ? 'failed' : 'finished',
  endedAt: variant === 'working' ? null : attempt.endedAt,
  ...(variant === 'failed' && { failureCause: 'provider_error' as const }),
});

const agentOf = ({ variant }: Params): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Fix comments · 4 comments',
  status: variant === 'working' ? 'running' : 'completed',
  kind: 'resolver',
  sourceKind: 'review_comment',
  startedAt: clock.iso({ at: '2026-10-28T09:30:00.000Z' }),
  doneAt: variant === 'working' ? undefined : clock.iso({ at: '2026-10-28T09:36:00.000Z' }),
  ...(variant === 'ready' && { outputSummary: SUMMARY_READY }),
  ...(variant === 'skipped' && { outputSummary: SUMMARY_SKIPPED }),
});

export const bResolveStateSeed = ({ variant }: Params): void => {
  seedBulkScene({ stage: 'review' });
  const state = useAppStore.getState();
  const wanted = new Set(KEYS.map((key) => threadOf({ key })));
  const queue = (state.sessionResolveQueueItems[SESSION_ID] ?? [])
    .filter((entry) => wanted.has(entry.thread.threadId))
    .map((entry) =>
      entryOf({ entry, index: KEYS.indexOf(entry.thread.threadId.slice(-2)), variant }),
    );
  const github = state.sessionGithub[SESSION_ID];
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: queue },
    sessionResolveAttempts: {
      [SESSION_ID]: (state.sessionResolveAttempts[SESSION_ID] ?? []).map((attempt) =>
        attemptOf({ attempt, variant }),
      ),
    },
    sessionPhaseRuns: { [SESSION_ID]: [agentOf({ variant })] },
    reviewSelection: { [SESSION_ID]: [] },
    ...(github === undefined || github.detail === null || github.detail === undefined
      ? {}
      : {
          sessionGithub: {
            [SESSION_ID]: {
              ...github,
              detail: {
                ...github.detail,
                comments: github.detail.comments.filter(
                  (comment) => comment.threadId !== undefined && wanted.has(comment.threadId),
                ),
              },
            },
          },
        }),
  });
};
