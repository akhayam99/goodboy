import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fallbackStepOutputSummary, stripControlMarkers } from '@goodboy/core';
import { Markdown, SectionSurface, StatusDot } from '@goodboy/ui';
import type { Agent, Session, TurnState } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useTranscript } from '../../../../store/transcript';
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { AGENT_KIND_META, classifyAgent } from '../../agent-kind';
import { AgentMetaLine } from './AgentMetaLine';
import { AgentBriefChildren } from './AgentBriefChildren';
import { AgentBriefPlans } from './AgentBriefPlans';
import { AgentBriefQuestions } from './AgentBriefQuestions';
import { AgentFollowUps } from './AgentFollowUps';
import { agentFollowUpMoves } from './followUpMoves';
import { selectFollowUpChildren } from './followUpChildren';
import { agentNowState } from './agentNowState';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

export const AgentBrief = ({ session, agent }: Props) => {
  const transcript = useTranscript(agent.id);
  const runs = useAppStore(
    (state) => state.sessionPhaseRuns[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  const kindOverride = useAppStore((state) => state.agentKindOverride[agent.id] ?? null);
  const plans = useAppStore((state) => state.sessionPlans[session.id] ?? EMPTY_ARRAY);
  const turnStates = useAppStore(
    useShallow((state) => {
      const states: Record<string, TurnState> = {};
      for (const run of runs) {
        const turn = state.agentTurnState[run.id];
        if (turn === undefined) {
          continue;
        }
        states[run.id] = turn;
      }
      return states;
    }),
  );
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const metrics = useAgentMetrics({ sessionId: session.id });
  const children = useMemo(
    () => selectSpawnedChildren({ runs, parentAgentId: agent.id, turnStates }),
    [agent.id, runs, turnStates],
  );
  const kind = classifyAgent(agent, kindOverride);
  const followUps = useMemo(
    () =>
      selectFollowUpChildren({
        spawned: children,
        kinds: agentFollowUpMoves({ sourceKind: kind }).map((move) => move.kind),
      }),
    [children, kind],
  );
  const laneChildren = useMemo(() => {
    const followUpIds = new Set(followUps.map((entry) => entry.child.agent.id));
    return children.filter((child) => !followUpIds.has(child.agent.id));
  }, [children, followUps]);
  const step = useMemo(() => {
    if (agent.workflowRunId == null || agent.stepId == null) {
      return null;
    }
    const attached = attachedRuns.find(({ run }) => run.id === agent.workflowRunId) ?? null;
    return attached?.workflow.steps.find((candidate) => candidate.id === agent.stepId) ?? null;
  }, [agent.stepId, agent.workflowRunId, attachedRuns]);
  const lastAssistantText = useMemo(() => {
    const items = reduceTranscript(transcript);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item?.kind === 'assistant_text') {
        return item.text.trim();
      }
    }
    return '';
  }, [transcript]);
  const trimmedOutputSummary = agent.outputSummary?.trim() ?? '';
  const hasOutputSummary = trimmedOutputSummary !== '';
  const summary = hasOutputSummary
    ? trimmedOutputSummary
    : lastAssistantText === ''
      ? ''
      : fallbackStepOutputSummary({ output: lastAssistantText });
  const expectedOutput = step?.expectedOutput?.trim() ?? AGENT_KIND_META[kind].expectedOutput;
  const isTerminal =
    agent.status === 'completed' || agent.status === 'failed' || agent.status === 'skipped';
  const now = agentNowState({ agent, turnState, transcript });

  return (
    <div className="flex flex-col gap-4">
      <AgentBriefQuestions session={session} agent={agent} />
      {summary !== '' ? (
        <SectionSurface label={hasOutputSummary ? 'Outcome' : 'Latest'} headingLevel={2}>
          <div className="text-sm text-foreground">
            <Markdown text={stripControlMarkers(summary)} />
          </div>
          {!hasOutputSummary ? (
            <span className="text-2xs text-muted-foreground">from the last reply</span>
          ) : null}
        </SectionSurface>
      ) : null}
      {!isTerminal ? (
        <SectionSurface label="Now">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <StatusDot tone={now.tone} size="sm" pulsing={now.isPulsing} />
            <span>{now.label}</span>
          </div>
        </SectionSurface>
      ) : null}
      {expectedOutput != null && expectedOutput !== '' ? (
        <SectionSurface label="Expected output">
          <p className="text-sm text-foreground">{expectedOutput}</p>
        </SectionSurface>
      ) : null}
      <AgentBriefPlans
        plans={plans.filter((plan) => plan.agentId === agent.id)}
        sessionId={session.id}
      />
      <AgentFollowUps
        sourceAgent={agent}
        sourceKind={kind}
        summary={summary}
        sessionId={session.id}
        followUps={followUps}
      />
      <AgentBriefChildren session={session} kind={kind} children={laneChildren} />
      <AgentMetaLine
        aggregate={metrics.aggregatesByAgentId.get(agent.id) ?? null}
        contextUsage={metrics.providerUsageByAgentId.get(agent.id) ?? EMPTY_ARRAY}
        turns={metrics.turnsByAgentId.get(agent.id) ?? 0}
      />
    </div>
  );
};
