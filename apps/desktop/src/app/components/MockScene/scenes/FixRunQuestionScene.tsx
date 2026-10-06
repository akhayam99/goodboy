import { useEffect, useState } from 'react';
import type { Agent, AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  SESSION_ID,
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

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 40,
  name: 'Resolve: 3 review comments',
  kind: 'resolver',
  status: 'completed',
  runId: `${AGENT_ID}-run` as ProviderRunId,
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
    const { navigate, sessionResolveQueueItems } = useAppStore.getState();
    const queue = (sessionResolveQueueItems[SESSION_ID] ?? []).map((entry) => {
      const sha = READY_COMMITS[entry.thread.threadId];
      return sha === undefined
        ? entry
        : { item: entry.item, thread: { ...entry.thread, commitShas: [sha] } };
    });
    useAppStore.setState({
      navigate,
      sessionResolveQueueItems: { [SESSION_ID]: queue },
      selectedAgentId: {},
      currentSessionId: SESSION_ID,
      activeLens: { [SESSION_ID]: null },
      sessionPhaseRuns: { [SESSION_ID]: [AGENT] },
      agentTurnState: {
        [AGENT_ID]: { kind: 'ended', endedAt: isoAgo({ minutes: 12 }) },
      },
      agentRunHistory: { [AGENT_ID]: [AGENT.runId as ProviderRunId] },
    });
    navigate({ to: agentPlace({ sessionId: SESSION_ID, agentId: AGENT_ID, pane: 'brief' }) });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <WorkspaceFrame session={SESSION} />;
};
