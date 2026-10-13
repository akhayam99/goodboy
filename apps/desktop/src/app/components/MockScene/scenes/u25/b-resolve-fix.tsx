import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProviderRunId,
  ResolveAttempt,
  ResolveQueueItemWithThread,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { fixRunTranscript } from '../../../../../store/slices/navigation/place';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import {
  QUESTION_OPTIONS,
  QUEUE_ITEMS,
  SESSION,
  SESSION_ID,
  seedResolveScene,
} from '../resolveSeed';

type Variant = 'working' | 'ready' | 'question' | 'failed';

type Props = {
  readonly variant: Variant;
};

const clock = sceneClock({ anchor: '2026-09-04T14:20:00.000Z' });
const NOW = clock.ms({ at: '2026-09-04T14:20:00.000Z' });
const MINUTE = 60_000;
const AGENT_ID = brandedId<AgentId>({ value: 'mock-b-resolve-fix-agent' });
const RUN_ID = brandedId<ProviderRunId>({ value: `${AGENT_ID}-run` });
const ATTEMPT_ID = 'mock-b-resolve-fix-attempt';
const COUNT = 8;
const QUESTION_INDEX = 2;
const FAILED_INDEX = 5;
const SUMMARY =
  'Capped the retry loop, added the exhaustion metric, fixed the typo and moved the retry constant into config.';

const covered = QUEUE_ITEMS.slice(0, COUNT);
const threadIds = covered.map((entry) => entry.thread.threadId);

type AgoParams = {
  readonly minutes: number;
};

type IndexParams = {
  readonly index: number;
};

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
  readonly index: number;
  readonly variant: Variant;
};

const isoAgo = ({ minutes }: AgoParams): IsoDateTime =>
  brandedId<IsoDateTime>({ value: new Date(NOW - minutes * MINUTE).toISOString() });

const shaOf = ({ index }: IndexParams): string =>
  `${(index + 1).toString(16)}b7d10e5c2a94f8601de7b3a95c40d1e82f6a7b9`.padStart(40, '0');

const agentOf = ({ variant }: Props): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 40,
  name: `Resolve: ${COUNT} review comments`,
  kind: 'resolver',
  status: variant === 'working' ? 'running' : 'completed',
  runId: RUN_ID,
  startedAt: isoAgo({ minutes: 9 }),
  completedAt: variant === 'working' ? undefined : isoAgo({ minutes: 1 }),
  outputSummary: variant === 'working' ? undefined : SUMMARY,
  providerOverride: 'anthropic',
  modelOverride: 'claude-opus-5-5',
});

const attemptOf = ({ variant }: Props): ResolveAttempt => ({
  id: ATTEMPT_ID,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  prNumber: 318,
  threadIds,
  launchId: `${ATTEMPT_ID}-launch`,
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
  instructions: null,
  phase:
    variant === 'working'
      ? 'running'
      : variant === 'question'
        ? 'waiting'
        : variant === 'failed'
          ? 'failed'
          : 'finished',
  mountTarget: null,
  startedAt: NOW - 9 * MINUTE,
  endedAt: variant === 'working' ? null : NOW - MINUTE,
  error: variant === 'failed' ? 'No result from the run' : null,
  createdAt: NOW - 9 * MINUTE,
  batchId: null,
  copyPath: null,
  launchChoice: null,
  ...(variant === 'failed' && { failureCause: 'provider_error' as const }),
});

const QUESTION: OpenQuestion = {
  id: brandedId<OpenQuestionId>({ value: 'mock-b-resolve-fix-question' }),
  sessionId: SESSION_ID,
  createdByAgentId: AGENT_ID,
  text: 'Should exhausted retries return a 200 with a warning, or fail hard?',
  suggestedAnswers: QUESTION_OPTIONS,
  recommendedAnswer: QUESTION_OPTIONS[0],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: isoAgo({ minutes: 2 }),
};

const entryOf = ({ entry, index, variant }: EntryParams): ResolveQueueItemWithThread => {
  const base = { ...entry.thread, activeAttemptId: ATTEMPT_ID, question: null };
  if (variant === 'working') {
    return { item: entry.item, thread: { ...base, stage: 'working', commitShas: null } };
  }
  if (variant === 'question' && index === QUESTION_INDEX) {
    return {
      item: entry.item,
      thread: {
        ...base,
        state: 'needs_answer',
        stage: 'asking',
        stateReason: 'question',
        question: QUESTION.text,
        commitShas: null,
      },
    };
  }
  if (variant === 'failed' && index === FAILED_INDEX) {
    return {
      item: entry.item,
      thread: { ...base, state: 'failed', stage: 'failed', stateReason: null, commitShas: null },
    };
  }
  return {
    item: entry.item,
    thread: {
      ...base,
      state: 'fixed',
      stage: 'proposed',
      disposition: 'fix',
      commitShas: [shaOf({ index })],
    },
  };
};

const transcriptOf = ({ variant }: Props): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: RUN_ID,
    text: `Resolve the ${COUNT} review comments on #318.`,
    at: isoAgo({ minutes: 9 }),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta:
      variant === 'working'
        ? 'Running the typecheck, then renaming the files the comments point at.'
        : SUMMARY,
    at: isoAgo({ minutes: variant === 'working' ? 0.5 : 1 }),
  },
];

const ResolveFixScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    const { navigate, sessionResolveQueueItems } = useAppStore.getState();
    const queue = (sessionResolveQueueItems[SESSION_ID] ?? []).map((entry) => {
      const index = threadIds.indexOf(entry.thread.threadId);
      return index === -1 ? entry : entryOf({ entry, index, variant });
    });
    const turn: TurnState =
      variant === 'working'
        ? { kind: 'running', runId: RUN_ID, startedAt: isoAgo({ minutes: 9 }) }
        : { kind: 'ended', endedAt: isoAgo({ minutes: 1 }) };
    useAppStore.setState({
      navigate,
      sessionResolveQueueItems: { [SESSION_ID]: queue },
      sessionResolveAttempts: { [SESSION_ID]: [attemptOf({ variant })] },
      sessionOpenQuestions: { [SESSION_ID]: variant === 'question' ? [QUESTION] : [] },
      selectedAgentId: {},
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: null },
      sessionPhaseRuns: { [SESSION_ID]: [agentOf({ variant })] },
      agentTurnState: { [AGENT_ID]: turn },
      transcripts: { [AGENT_ID]: transcriptOf({ variant }) },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
    });
    navigate(fixRunTranscript({ sessionId: SESSION_ID, agentId: AGENT_ID }));
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }

  return <WorkspaceFrame session={SESSION} />;
};

export const U25_B_RESOLVE_FIX_SCENES = {
  'resolve-fix-working': () => <ResolveFixScene variant="working" />,
  'resolve-fix-ready': () => <ResolveFixScene variant="ready" />,
  'resolve-fix-question': () => <ResolveFixScene variant="question" />,
  'resolve-fix-failed': () => <ResolveFixScene variant="failed" />,
};
