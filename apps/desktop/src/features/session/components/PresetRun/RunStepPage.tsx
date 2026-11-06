import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { AgentDetailPane } from '../AgentDetailPane';
import type { RunView } from '../AgentTree/useRunView';
import { resolveRootAgent } from '../../agent-kind';
import { leaveRunLevel } from '../../../workflows/leaveRunLevel';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { stepReasonOf } from '../../../workflows/stepReasonOf';
import { RunStepActions } from './RunStepActions';
import { RunStepHeading } from './RunStepHeading';
import { RunTail } from './RunTail';
import { stepStopLabelOf } from './stepStopLabelOf';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly agent: Agent;
};

export const RunStepPage = ({ session, view, agent }: Props) => {
  const phaseRuns = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const stepAgent = resolveRootAgent({ agents: phaseRuns, agentId: agent.id });
  const reason = stepReasonOf({ run: view.run, workflow: view.workflow, agent, stepAgent });
  return (
    <AgentDetailPane
      key={agent.id}
      session={session}
      agent={agent}
      isChatActive
      onBack={() => leaveRunLevel({ sessionId: session.id })}
      context={
        reason === '' ? null : (
          <p data-step-reason="" className="text-ui text-muted-foreground">
            {ORCHESTRATED_COPY.why({ reason })}
          </p>
        )
      }
      runStep={{
        heading: <RunStepHeading agent={agent} stepAgent={stepAgent} workflow={view.workflow} />,
        actions: (
          <RunStepActions sessionId={session.id} runId={view.run.id} stepAgentId={agent.id} />
        ),
        tail: <RunTail session={session} view={view} selectedAgentId={agent.id} />,
        stopLabel: stepStopLabelOf({ agent, stepAgent, workflow: view.workflow }),
      }}
    />
  );
};
