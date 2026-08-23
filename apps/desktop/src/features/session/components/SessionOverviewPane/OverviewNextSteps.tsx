import { useMemo } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { splitWorkflowRuns } from '../../../workflows/activeWorkflowRuns';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { useWorkflowAdvanceStates } from '../../../workflows/useWorkflowAdvanceStates';
import { OverviewNextStep } from './OverviewNextStep';

type Props = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
};

export const OverviewNextSteps = ({ session, agents }: Props) => {
  const attachedRuns = useAttachedWorkflowRuns({ session });
  const { agentsByRunId, active } = useMemo(
    () => splitWorkflowRuns({ attachedRuns, agents }),
    [agents, attachedRuns],
  );
  const advanceByRunId = useWorkflowAdvanceStates({
    sessionId: session.id,
    workflows: active,
    agents,
  });
  const waiting = active.filter(({ run }) => advanceByRunId.get(run.id)?.kind === 'ready');

  if (waiting.length === 0) {
    return null;
  }

  return (
    <section aria-label="Up next" className="flex flex-col gap-2">
      <Eyebrow label="Up next" className="px-0.5" />
      <div className="flex flex-col items-start gap-1.5">
        {waiting.map(({ run, workflow }) => {
          const state = advanceByRunId.get(run.id);
          if (state?.kind !== 'ready') {
            return null;
          }
          return (
            <OverviewNextStep
              key={run.id}
              sessionId={session.id}
              workflow={workflow}
              runAgents={agentsByRunId.get(run.id) ?? []}
              stepId={state.step.id}
            />
          );
        })}
      </div>
    </section>
  );
};
