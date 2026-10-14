import { useEffect, useState } from 'react';
import type { Agent, AgentId, IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  SESSION_ID,
  FIX_RUN_MOUNT,
  THREAD_IDS,
  seedResolveScene,
} from './resolveSeed';
import { WorkspaceFrame } from './audit/WorkspaceFrame';

const AGENT_ID = 'mock-resolve-agent-retry' as AgentId;
const MINUTE = 60_000;

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

const READY_COMMITS: Readonly<Record<string, string>> = {
  [EXPANDED_THREAD_ID]: 'c81e5aa0f3b2d94e7a1c6580de4b9f2a37c1d085',
  [THREAD_IDS.metrics]: '3b7d10e5c2a94f8601de7b3a95c40d1e82f6a7b9',
};

const RUN_ID = `${AGENT_ID}-run` as ProviderRunId;

const TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_ID,
    text: 'Resolve the 3 review comments on #318.',
    at: isoAgo({ minutes: 18 }),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta: 'Fixed two comments and asked about the third.',
    at: isoAgo({ minutes: 12 }),
  },
];

const COVERED_THREAD_IDS: ReadonlySet<string> = new Set([
  EXPANDED_THREAD_ID,
  THREAD_IDS.metrics,
  THREAD_IDS.errorShape,
]);

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 40,
  name: 'Resolve: 3 review comments',
  kind: 'resolver',
  status: 'completed',
  runId: RUN_ID,
  startedAt: isoAgo({ minutes: 18 }),
  completedAt: isoAgo({ minutes: 12 }),
  outputSummary: 'Fixed two comments and asked about the third.',
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5',
};

export const FixRunQuestionScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedResolveScene({ expandedThreadId: null });
    const { navigate, sessionResolveQueueItems, sessionResolveAttempts } = useAppStore.getState();
    const queue = (sessionResolveQueueItems[SESSION_ID] ?? []).map((entry) => {
      if (entry.thread.activeAttemptId !== null && !COVERED_THREAD_IDS.has(entry.thread.threadId)) {
        return {
          item: entry.item,
          thread: {
            ...entry.thread,
            stage: 'new' as const,
            state: 'open' as const,
            activeAttemptId: null,
          },
        };
      }
      const sha = READY_COMMITS[entry.thread.threadId];
      return sha === undefined
        ? entry
        : { item: entry.item, thread: { ...entry.thread, commitShas: [sha] } };
    });
    useAppStore.setState({
      navigate,
      sessionResolveQueueItems: { [SESSION_ID]: queue },
      sessionResolveAttempts: {
        [SESSION_ID]: (sessionResolveAttempts[SESSION_ID] ?? []).filter(
          (attempt) => attempt.agentId === AGENT_ID,
        ),
      },
      transcripts: { [AGENT_ID]: TRANSCRIPT },
      sessionProjectMounts: { [SESSION_ID]: [FIX_RUN_MOUNT] },
      selectedAgentId: {},
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: null },
      sessionPhaseRuns: { [SESSION_ID]: [AGENT] },
      agentTurnState: {
        [AGENT_ID]: { kind: 'ended', endedAt: isoAgo({ minutes: 12 }) },
      },
      agentRunHistory: { [AGENT_ID]: [AGENT.runId as ProviderRunId] },
    });
    navigate({ to: agentPlace({ sessionId: SESSION_ID, agentId: AGENT_ID }) });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <WorkspaceFrame session={SESSION} />;
};
