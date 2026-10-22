import { parseWorkflowRules, type WorkflowRules } from '@goodboy/types';

type Params = {
  readonly rules: WorkflowRules;
};

export const rulesWithoutAsk = ({ rules }: Params): WorkflowRules =>
  parseWorkflowRules({ value: { ...rules, pendingChange: null, approvedChange: null } }) ?? rules;
