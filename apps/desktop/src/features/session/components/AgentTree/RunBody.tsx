import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { EmptyState, PageColumn, PANE_RHYTHM, ScrollFade, TERMINAL_DIM, cn } from '@goodboy/ui';
import type { AgentId, OpenQuestion, Session } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { openAgentRevealEvent } from '../../../../shared/utils/openAgentReveal';
import { agentPlace, sessionPlace, useAppStore } from '../../../../store';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import type { AgentKind } from '../../agent-kind';
import { WorkflowResumeStrip } from './WorkflowResumeStrip';
import { RunAddStep } from './RunAddStep';
import { RunFinishedActions } from './RunFinishedActions';
import { RunGoal } from './RunGoal';
import { RunWriteDestination } from './RunWriteDestination';
import { skipStepDescription } from '../../../workflows/skipStepCopy';
import type { RunView } from './useRunView';
import { OrchestratorStrip } from '../../../workflows/components/OrchestratorStrip';
import { RunTree } from '../../../workflows/components/RunTree';
import { useRunTree } from '../../../workflows/components/RunTree/useRunTree';
import { WorkflowDecisions } from '../../../workflows/components/WorkflowDecisions';
import { WorkflowRunSummary } from '../../../workflows/components/WorkflowRunSummary';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

export const RunBody = ({ session, view }: Props) => {
  const { run, workflow, agents, isDiscarded, isDynamic, isCompleted } = view;
  const sessionId = session.id;
  const roleModels = useSessionRoleModels({ sessionId });
  const navigate = useAppStore((state) => state.navigate);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const focusQuestion = useOpenQuestions((state) => state.focusQuestion);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const agentKindOverride = useAppStore(
    useShallow((state) => {
      const overrides: Record<string, AgentKind> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ?? []) {
        const kind = state.agentKindOverride[agent.id];
        if (kind !== undefined) {
          overrides[agent.id] = kind;
        }
      }
      return overrides;
    }),
  );
  const tree = useRunTree({ session, run, workflow, agentKindOverride });
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const selectedStepId =
    agents.find((agent) => agent.id === selectedAgentId && agent.parentAgentId == null)?.stepId ??
    null;
  const highlightedStepId = hoveredStepId ?? selectedStepId;
  const sessionProvider = session.providerPreference?.defaultProvider ?? null;
  const sessionEffort = session.effort ?? null;

  const onPickAgent = (agentId: AgentId) => {
    if (agentId !== selectedAgentId) {
      navigate({ to: agentPlace({ sessionId, agentId }) });
    }
    window.dispatchEvent(openAgentRevealEvent());
  };

  const onAnswerQuestion = (question: OpenQuestion | null) => {
    if (question !== null) {
      focusQuestion(question.id);
    }
    navigate({ to: sessionPlace({ sessionId, lens: 'questions' }) });
  };

  return (
    <ScrollFade
      className={cn('min-h-0 min-w-0 flex-1', isDiscarded && TERMINAL_DIM)}
      fadeSize={24}
      edge="line"
    >
      <PageColumn className={cn(PANE_RHYTHM.stack, 'pb-5')}>
        {isDiscarded ? null : <RunWriteDestination sessionId={sessionId} />}
        {!isDiscarded && isDynamic && (
          <OrchestratorStrip
            sessionId={sessionId}
            run={run}
            agents={agents}
            steps={workflow.steps}
            state={view.orchestrator.state}
            isOrchestrating={view.isOrchestrating}
          />
        )}
        {!isDiscarded && (
          <WorkflowResumeStrip sessionId={sessionId} runId={run.id} agents={agents} />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          {agents.length > 0 ? (
            <RunTree
              sessionId={sessionId}
              runId={run.id}
              tree={tree}
              routing={{
                stepById: new Map(workflow.steps.map((step) => [step.id, step])),
                roleModels,
                sessionProvider,
                sessionEffort,
                run,
              }}
              selectedAgentId={selectedAgentId}
              highlightedStepId={highlightedStepId}
              skip={
                isDiscarded || isCompleted
                  ? null
                  : {
                      describe: (agent) => skipStepDescription({ run, agent, agents }),
                      onSkip: (agent) =>
                        skipStuckStepAndAdvance(sessionId, run.id, {
                          force: true,
                          agentId: agent.id,
                        }),
                    }
              }
              onHighlight={setHoveredStepId}
              onSelect={onPickAgent}
              onAnswer={onAnswerQuestion}
            />
          ) : (
            <EmptyState
              size="section"
              icon={CONCEPT_ICONS.agents}
              title="No agents yet"
              description="The run starts its first step here."
            />
          )}
          {!isDiscarded && !isCompleted && (
            <RunAddStep
              sessionId={sessionId}
              workspaceId={workflow.workspaceId}
              workflowRunId={run.id}
              stepCount={view.stepCount}
            />
          )}
        </div>
        <WorkflowRunSummary summary={run.orchestratorSummary} />
        <RunGoal run={run} workflow={workflow} />
        {isDynamic && (
          <WorkflowDecisions
            run={run}
            steps={workflow.steps}
            tree={tree}
            highlightedStepId={highlightedStepId}
            onHighlight={setHoveredStepId}
          />
        )}
        {isCompleted && (
          <RunFinishedActions
            sessionId={sessionId}
            workflowRunId={run.id}
            trailing={
              <RunAddStep
                sessionId={sessionId}
                workspaceId={workflow.workspaceId}
                workflowRunId={run.id}
                stepCount={view.stepCount}
              />
            }
          />
        )}
      </PageColumn>
    </ScrollFade>
  );
};
