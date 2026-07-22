import { useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { classifyWorkflowChain, findReusableAgent, runsForWorkflowRun } from '@goodboy/core';
import type { Agent, SessionId, Workflow, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflow: Workflow;
  readonly runs: ReadonlyArray<Agent>;
};

export const WorkflowStepperAdvance = ({ sessionId, workflowRunId, workflow, runs }: Props) => {
  const agentTurnState = useAppStore((state) => state.agentTurnState);
  const skipStuckStepAndAdvance = useAppStore((state) => state.skipStuckStepAndAdvance);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const scoped = runsForWorkflowRun(runs, workflowRunId);
  const chain = classifyWorkflowChain(workflow, scoped);
  if (chain.kind === 'complete') {
    return null;
  }
  const step = chain.kind === 'blocked' ? chain.failedStep : chain.step;
  const agent = findReusableAgent(scoped, step.id);
  if (agent == null || agent.status === 'pending') {
    return null;
  }
  const turn = agentTurnState?.[agent.id];
  if (turn?.kind === 'running' || turn?.kind === 'starting') {
    return null;
  }

  const onForce = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setArmed(false);
    try {
      await skipStuckStepAndAdvance(sessionId, workflowRunId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ArrowRight size={11} aria-hidden className="shrink-0 text-muted-foreground/30" />
      <button
        type="button"
        disabled={busy}
        data-testid="workflow-stepper-force-next"
        onClick={() => {
          if (armed) {
            void onForce();
            return;
          }
          setArmed(true);
        }}
        onBlur={() => setArmed(false)}
        title={`skip ${step.name} and start the next step with the context gathered so far`}
        className="flex items-center gap-1 rounded-sm px-1 text-xs font-medium text-warning transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:text-warning/80 disabled:cursor-default disabled:opacity-60"
      >
        <AlertTriangle size={11} aria-hidden className="shrink-0" />
        <span>{armed ? 'confirm skip' : 'force next step'}</span>
      </button>
    </div>
  );
};
