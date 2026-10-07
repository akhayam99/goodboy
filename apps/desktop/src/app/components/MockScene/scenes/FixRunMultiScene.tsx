import { useEffect, useState } from 'react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  ResolveAttempt,
  TurnEvent,
  TurnState,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { fixRunTranscript } from '../../../../store/slices/navigation/place';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  SESSION_ID,
  THREAD_IDS,
  seedResolveScene,
} from './resolveSeed';
import { WorkspaceFrame } from './audit/WorkspaceFrame';

type Props = {
  readonly isDone?: boolean;
};

const AGENT_ID = 'mock-fix-run-multi-agent' as AgentId;
const RUN_ID = `${AGENT_ID}-run` as ProviderRunId;
const ATTEMPT_ID = 'mock-fix-run-multi-attempt';
const MINUTE = 60_000;
const COVERED_THREAD_IDS = [
  EXPANDED_THREAD_ID,
  THREAD_IDS.metrics,
  THREAD_IDS.typo,
  THREAD_IDS.retryConstant,
] as const;
const COMMIT_SHAS: Readonly<Record<string, string>> = {
  [EXPANDED_THREAD_ID]: 'c81e5aa0f3b2d94e7a1c6580de4b9f2a37c1d085',
  [THREAD_IDS.metrics]: '3b7d10e5c2a94f8601de7b3a95c40d1e82f6a7b9',
};
const SUMMARY =
  'Capped the retry loop, added the exhaustion metric, fixed the typo and moved the retry constant into config.';

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

const agentOf = ({ isDone }: { readonly isDone: boolean }): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 40,
  name: 'Resolve: 4 review comments',
  kind: 'resolver',
  status: isDone ? 'completed' : 'running',
  runId: RUN_ID,
  startedAt: isoAgo({ minutes: 5 }),
  completedAt: isDone ? isoAgo({ minutes: 1 }) : undefined,
  outputSummary: isDone ? SUMMARY : undefined,
  providerOverride: 'anthropic',
  modelOverride: 'claude-opus-5-5',
});

const attemptOf = ({ isDone }: { readonly isDone: boolean }): ResolveAttempt => ({
  id: ATTEMPT_ID,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  prNumber: 318,
  threadIds: COVERED_THREAD_IDS,
  launchId: `${ATTEMPT_ID}-launch`,
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
  instructions: null,
  phase: isDone ? 'finished' : 'running',
  mountTarget: null,
  startedAt: Date.now() - 5 * MINUTE,
  endedAt: isDone ? Date.now() - MINUTE : null,
  error: null,
  createdAt: Date.now() - 5 * MINUTE,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

const transcriptOf = ({ isDone }: { readonly isDone: boolean }): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: RUN_ID,
    text: 'Resolve the 4 review comments on #318.',
    at: isoAgo({ minutes: 5 }),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta: isDone
      ? SUMMARY
      : 'Running the typecheck, then renaming the files the comments point at.',
    at: isoAgo({ minutes: isDone ? 1 : 0.5 }),
  },
];

export const FixRunMultiScene = ({ isDone = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    const { navigate, sessionResolveQueueItems } = useAppStore.getState();
    const queue = (sessionResolveQueueItems[SESSION_ID] ?? []).map((entry) => {
      if (!COVERED_THREAD_IDS.some((threadId) => threadId === entry.thread.threadId)) {
        return entry;
      }
      const sha = COMMIT_SHAS[entry.thread.threadId];
      return {
        item: entry.item,
        thread: {
          ...entry.thread,
          stage: isDone ? ('proposed' as const) : ('working' as const),
          activeAttemptId: ATTEMPT_ID,
          question: null,
          commitShas: isDone && sha !== undefined ? [sha] : null,
        },
      };
    });
    const turn: TurnState = isDone
      ? { kind: 'ended', endedAt: isoAgo({ minutes: 1 }) }
      : { kind: 'running', runId: RUN_ID, startedAt: isoAgo({ minutes: 5 }) };
    useAppStore.setState({
      navigate,
      sessionResolveQueueItems: { [SESSION_ID]: queue },
      sessionResolveAttempts: { [SESSION_ID]: [attemptOf({ isDone })] },
      selectedAgentId: {},
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: null },
      sessionPhaseRuns: { [SESSION_ID]: [agentOf({ isDone })] },
      agentTurnState: { [AGENT_ID]: turn },
      transcripts: { [AGENT_ID]: transcriptOf({ isDone }) },
      agentRunHistory: { [AGENT_ID]: [RUN_ID] },
    });
    navigate(fixRunTranscript({ sessionId: SESSION_ID, agentId: AGENT_ID }));
    setIsReady(true);
  }, [isDone]);

  if (!isReady) {
    return null;
  }

  return <WorkspaceFrame session={SESSION} />;
};
