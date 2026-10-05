import { useEffect, useState } from 'react';
import type { Agent, AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { SESSION, SESSION_ID, seedResolveScene } from './resolveSeed';
import { WorkspaceFrame } from './audit/WorkspaceFrame';

const AGENT_ID = 'mock-resolve-agent-retry' as AgentId;
const MINUTE = 60_000;

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

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
    const { navigate } = useAppStore.getState();
    useAppStore.setState({
      navigate,
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
