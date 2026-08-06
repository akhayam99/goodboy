import { useMemo } from 'react';
import type { Agent, Session, SessionId, Workflow, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionOpenQuestions } from '../../../../store';
import type { LensKind } from '../../../../store';
import { notifyWorkflowGateBlock } from '../../../../store/slices/workflows/notifyWorkflowGateBlock';
import { workflowRunHasOpenQuestions } from '../../../context/openQuestionsGate';
import type { SpawnNode } from '../../../orchestration/components/SpawnTree/lib';
import type { RunLaneModel } from '../../../orchestration/hooks/useWorkspaceRuns';
import { AgentRow } from './AgentRow';
import type { LaneAdvance } from './LaneAdvance';
import { PipelineLane } from './PipelineLane';

type Props = {
  readonly session: Session;
  readonly workspaceId: WorkspaceId;
  readonly lanes: ReadonlyArray<RunLaneModel>;
  readonly freeAgents: ReadonlyArray<SpawnNode>;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const PipelineSection = ({
  session,
  workspaceId,
  lanes,
  freeAgents,
  onSelectLens,
}: Props) => {
  const sessionId = session.id as SessionId;
  const setFocusedWorkflowRun = useAppStore((s) => s.setFocusedWorkflowRun);
  const activateWorkflowAgent = useAppStore((s) => s.activateWorkflowAgent);
  const emitNotification = useAppStore((s) => s.emitNotification);
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
  const isSummarizerRunning = useAppStore(
    (s) => s.summarizerStatus[sessionId]?.status === 'running',
  );

  const workflowById = useMemo(() => {
    const m = new Map<string, Workflow>();
    for (const w of phaseTemplates) m.set(w.id, w);
    for (const w of sessionWorkflows) m.set(w.id, w);
    return m;
  }, [phaseTemplates, sessionWorkflows]);

  if (lanes.length === 0 && freeAgents.length === 0) {
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
      isSummarizerRunning,
      onAdvance: async (step) => {
        const agent = workflowAgents.find((r) => r.stepId === step.id);
        if (agent?.status !== 'pending') {
          return;
        }
        try {
          await activateWorkflowAgent({ sessionId, agentId: agent.id, focus: 'none' });
        } catch (error) {
          notifyWorkflowGateBlock({ error, sessionId, emitNotification });
        }
      },
    };
  };

  return (
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
    </div>
  );
};
