import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fallbackStepOutputSummary, stripControlMarkers } from '@goodboy/core';
import { Markdown, SectionSurface, StatusDot, Tooltip } from '@goodboy/ui';
import type { Agent, Session, TurnState } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionAnsweredQuestions,
  useSessionOpenQuestions,
} from '../../../../store';
import { useTranscript } from '../../../../store/transcript';
import { selectSpawnedChildren } from '../../../../shared/utils/spawnedChildren';
import { reduceTranscript } from '../../../chat/utils/transcript-items';
import { isQuestionDelegate } from '../../../context/questionDelegate';
import { useAgentMetrics } from '../../hooks/useAgentMetrics';
import { AGENT_KIND_META, classifyAgent } from '../../agent-kind';
import { AgentMetaLine } from './AgentMetaLine';
import { AgentAnsweringFor } from './AgentAnsweringFor';
import { AgentBriefDelegates } from './AgentBriefDelegates';
import { AgentBriefChildren } from './AgentBriefChildren';
import { AgentBriefPlans } from './AgentBriefPlans';
import { AgentBriefQuestions } from './AgentBriefQuestions';
import { AgentBriefWhy } from './AgentBriefWhy';
import { AgentFollowUps } from './AgentFollowUps';
import { agentFollowUpMoves } from './followUpMoves';
import { selectFollowUpChildren } from './followUpChildren';
import { agentNowState } from './agentNowState';
import { AgentMuchLonger } from './AgentMuchLonger';
import type { WorkTime } from '../../../workTreeModel/workTime';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly time?: WorkTime | null;
};

export const AgentBrief = ({ session, agent, time = null }: Props) => {
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
  const openQuestions = useSessionOpenQuestions(session.id);
  const answeredQuestions = useSessionAnsweredQuestions(session.id);
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const metrics = useAgentMetrics({ sessionId: session.id });
  const children = useMemo(
    () => selectSpawnedChildren({ runs, parentAgentId: agent.id, turnStates }),
    [agent.id, runs, turnStates],
  );
  const kind = classifyAgent({ agent, override: kindOverride });
  const followUps = useMemo(
    () =>
      selectFollowUpChildren({
        spawned: children,
        kinds: agentFollowUpMoves({ sourceKind: kind }).map((move) => move.kind),
      }),
    [children, kind],
  );
  const delegates = useMemo(
    () => children.map((child) => child.agent).filter((agent) => isQuestionDelegate({ agent })),
    [children],
  );
  const laneChildren = useMemo(() => {
    const followUpIds = new Set(followUps.map((entry) => entry.child.agent.id));
    return children.filter(
      (child) => !followUpIds.has(child.agent.id) && !isQuestionDelegate({ agent: child.agent }),
    );
  }, [children, followUps]);
  const sessionQuestions = useMemo(
    () => [...openQuestions, ...answeredQuestions],
    [openQuestions, answeredQuestions],
  );
  const answeredQuestion = useMemo(() => {
    if (!isQuestionDelegate({ agent })) {
      return null;
    }
    return sessionQuestions.find((question) => question.id === agent.sourceThreadId) ?? null;
  }, [agent, sessionQuestions]);
  const asker = useMemo(() => {
    const parentId = agent.parentAgentId;
    if (parentId == null) {
      return null;
    }
    return runs.find((run) => run.id === parentId) ?? null;
  }, [agent.parentAgentId, runs]);
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
  const isSplitIntoSubagents = kind === 'implementer' && laneChildren.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <AgentAnsweringFor sessionId={session.id} question={answeredQuestion} asker={asker} />
      <AgentBriefQuestions session={session} agent={agent} />
      <AgentBriefWhy step={agent.parentAgentId == null ? step : null} />
      {summary !== '' && !isSplitIntoSubagents ? (
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
            <span className="min-w-0 flex-1 truncate">{now.label}</span>
            {time === null ? null : (
              <Tooltip content={time.detail}>
                <span
                  data-testid="agent-now-time"
                  className="shrink-0 text-2xs tabular-nums text-muted-foreground"
                >
                  {time.headline}
                </span>
              </Tooltip>
            )}
          </div>
          {time?.isMuchLonger === true ? <AgentMuchLonger /> : null}
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
        activePlanId={
          [...plans].reverse().find((plan) => plan.agentId === agent.id && plan.status === 'active')
            ?.id ?? null
        }
      />
      <AgentBriefDelegates
        sessionId={session.id}
        delegates={delegates}
        questions={sessionQuestions}
      />
      <AgentBriefChildren session={session} agent={agent} kind={kind} children={laneChildren} />
      <AgentMetaLine
        aggregate={metrics.aggregatesByAgentId.get(agent.id) ?? null}
        contextUsage={metrics.providerUsageByAgentId.get(agent.id) ?? EMPTY_ARRAY}
        turns={metrics.turnsByAgentId.get(agent.id) ?? 0}
      />
    </div>
  );
};
