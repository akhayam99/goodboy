import { useMemo } from 'react';
import type { Agent, PlanWithCount, SessionId } from '@goodboy/types';
import { useSessionOpenQuestions } from '../../../../store';
import { askingAgentIdsOf } from '../../askingAgentIdsOf';
import { planPartRows, type PlanPartRow } from './planPartRows';

type Params = {
  readonly sessionId: SessionId;
  readonly plan: PlanWithCount | null;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_ROWS: ReadonlyArray<PlanPartRow> = [];

export const usePlanPartRows = ({
  sessionId,
  plan,
  agents,
}: Params): ReadonlyArray<PlanPartRow> => {
  const questions = useSessionOpenQuestions(sessionId);
  const askingAgentIds = useMemo(() => askingAgentIdsOf({ questions }), [questions]);
  return useMemo(
    () => (plan === null ? NO_ROWS : planPartRows({ plan, agents, askingAgentIds })),
    [plan, agents, askingAgentIds],
  );
};
