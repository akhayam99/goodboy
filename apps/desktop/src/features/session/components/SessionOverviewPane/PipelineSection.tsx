import { useMemo } from 'react';
import { MessageSquareReply } from 'lucide-react';
import { Divider, Eyebrow } from '@goodboy/ui';
import type { Agent, Session, SessionId, Workflow, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../store';
import type { LensKind } from '../../../../store';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import { useWorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
import { AgentRow } from './AgentRow';
import type { LaneAdvance } from './LaneAdvance';
import { PipelineLane } from './PipelineLane';
import { SummaryRow } from './SummaryRow';

type Props = {
  readonly session: Session;
  readonly workspaceId: WorkspaceId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const PipelineSection = ({ session, workspaceId, onSelectLens }: Props) => {
  const sessionList = useMemo(() => [session], [session]);
  const {
    lanes,
    freeAgents,
    resolveQueue,
    completedLanes,
    completedFreeAgents,
    completedResolveQueue,
  } = useWorkspaceRuns(workspaceId, sessionList);
  const resolvedCompletedLanes = completedLanes ?? EMPTY_ARRAY;
  const resolvedCompletedFreeAgents = completedFreeAgents ?? EMPTY_ARRAY;
  const resolvedCompletedResolveQueue = completedResolveQueue ?? EMPTY_ARRAY;
  const sessionId = session.id as SessionId;
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates?.[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionWorkflows = useAppStore(
    (s) => s.sessionWorkflows?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const openQuestions = useSessionOpenQuestions(sessionId);

  const workflowById = useMemo(() => {
    const m = new Map<string, Workflow>();
    for (const w of phaseTemplates) m.set(w.id, w);
    for (const w of sessionWorkflows) m.set(w.id, w);
    return m;
  }, [phaseTemplates, sessionWorkflows]);

  const hasRunning = lanes.length > 0 || freeAgents.length > 0 || resolveQueue.length > 0;
  const hasCompleted =
    resolvedCompletedLanes.length > 0 ||
    resolvedCompletedFreeAgents.length > 0 ||
    resolvedCompletedResolveQueue.length > 0;

  if (!hasRunning && !hasCompleted) {
    return null;
  }

  const open = (runId: string) => {
    setFocusedWorkflowRun(sessionId, runId);
    onSelectLens('workflows');
  };

  const advanceFor = (runId: string): LaneAdvance | undefined => {
    const run = session.workflowRuns.find((r) => r.id === runId);
    const workflow = run ? workflowById.get(run.workflowId) : undefined;
    if (!run || !workflow) {
      return undefined;
    }
    const workflowAgents = phaseRuns.filter(
      (r) => r.workflowRunId === runId && r.stepId != null && r.parentAgentId == null,
    );
    return {
      workflow,
      runs: workflowAgents,
      hasOpenQuestions: workflowRunHasOpenQuestions(openQuestions, run.id),
      onAdvance: async (step) => {
        const agent = workflowAgents.find((r) => r.stepId === step.id);
        if (agent?.status === 'pending') {
          await activateWorkflowAgent(sessionId, agent.id, undefined, false);
        }
      },
    };
  };

  return (
    <div className="flex flex-col gap-2">
      {hasRunning ? (
        <>
          <Eyebrow label="Activity" muted className="px-0.5 font-medium" />
          <div className="flex flex-col gap-2">
            {lanes.map((lane) => (
              <PipelineLane
                key={lane.runId}
                lane={lane}
                onOpen={() => open(lane.runId)}
                advance={advanceFor(lane.runId)}
              />
            ))}
            {freeAgents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} onClick={() => onSelectLens('agents')} />
            ))}
            {resolveQueue.length > 0 ? (
              <SummaryRow
                icon={MessageSquareReply}
                tone="success"
                label={`${resolveQueue.length} in resolve queue`}
                onClick={() => onSelectLens('resolve')}
              />
            ) : null}
          </div>
        </>
      ) : null}
      {hasRunning && hasCompleted ? <Divider /> : null}
      {hasCompleted ? (
        <>
          <Eyebrow label="Completed" muted className="px-0.5 font-medium" />
          <div className="flex flex-col gap-2">
            {resolvedCompletedLanes.map((lane) => (
              <PipelineLane key={lane.runId} lane={lane} onOpen={() => open(lane.runId)} />
            ))}
            {resolvedCompletedFreeAgents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} onClick={() => onSelectLens('agents')} />
            ))}
            {resolvedCompletedResolveQueue.length > 0 ? (
              <SummaryRow
                icon={MessageSquareReply}
                tone="success"
                label={`${resolvedCompletedResolveQueue.length} in resolve queue`}
                onClick={() => onSelectLens('resolve')}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};
