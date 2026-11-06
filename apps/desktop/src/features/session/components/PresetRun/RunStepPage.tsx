import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { AgentDetailPane } from '../AgentDetailPane';
import type { RunView } from '../AgentTree/useRunView';
import { resolveRootAgent } from '../../agent-kind';
import { leaveRunLevel } from '../../../workflows/leaveRunLevel';
import { RunPageActions } from './RunPageActions';
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
  return (
    <AgentDetailPane
      key={agent.id}
      session={session}
      agent={agent}
      isChatActive
      onBack={() => leaveRunLevel({ sessionId: session.id })}
      runStep={{
        heading: <RunStepHeading agent={agent} stepAgent={stepAgent} workflow={view.workflow} />,
        actions: (
          <RunPageActions session={session} view={view} stepAgentId={stepAgent?.id ?? null} />
        ),
        tail: <RunTail session={session} view={view} selectedAgentId={agent.id} />,
        ...stepStopLabelOf({ agent, stepAgent, workflow: view.workflow }),
      }}
    />
  );
};
