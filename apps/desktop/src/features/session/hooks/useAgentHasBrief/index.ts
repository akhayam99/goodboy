import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useAgentOutcome } from '../../../../shared/hooks/useAgentOutcome';

type Params = {
  readonly session: Session;
  readonly agent: Agent;
};

export const useAgentHasBrief = ({ session, agent }: Params): boolean => {
  const outcome = useAgentOutcome({ agent });
  const hasQuestions = useAppStore((state) =>
    (state.sessionOpenQuestions[session.id] ?? []).some(
      (question) => question.createdByAgentId === agent.id,
    ),
  );
  const hasChildren = useAppStore((state) =>
    (state.sessionPhaseRuns[session.id] ?? []).some((run) => run.parentAgentId === agent.id),
  );
  const hasPlans = useAppStore((state) =>
    (state.sessionPlans[session.id] ?? []).some((plan) => plan.agentId === agent.id),
  );
  return outcome.text !== '' || hasQuestions || hasChildren || hasPlans;
};
