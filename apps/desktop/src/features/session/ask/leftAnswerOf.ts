import type { AgentId } from '@goodboy/types';
import { countNoun } from '../../../shared/utils/countNoun';
import { NAMES } from '../../../shared/utils/names';
import type { PlanPartsLeft } from '../../plans/planPartsLeftOf';
import type { AskSessionAnswer } from './AskSessionAnswer';

type Params = Readonly<{
  plan: PlanPartsLeft | null;
  leadId: AgentId | null;
}>;

type TextParams = Readonly<{
  plan: PlanPartsLeft;
}>;

const planTextOf = ({ plan }: TextParams): string => {
  if (plan.total === 0) {
    return 'The plan lists no parts.';
  }
  if (plan.left.length === 0) {
    return 'Every part of the plan is done.';
  }
  const started = plan.hasRun ? '' : ', none started';
  return `${countNoun({ count: plan.left.length, one: 'part' })} left in the plan${started}: ${plan.left.join(', ')}.`;
};

export const leftAnswerOf = ({ plan, leadId }: Params): AskSessionAnswer => {
  if (plan === null) {
    const ask = leadId === null ? '' : ` Message the ${NAMES.lead} to ask for one.`;
    return { text: `${NAMES.noPlanOnThisSession}.${ask}`, sources: [], agentId: leadId };
  }
  return {
    text: planTextOf({ plan }),
    sources: [`Plan, ${plan.title}`],
    agentId: null,
  };
};
