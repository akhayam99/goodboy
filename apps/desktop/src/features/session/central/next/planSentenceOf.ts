import type { AutoPlanFacts } from '../../../auto/autoRetryTargetsOf';

type Params = {
  readonly plan: AutoPlanFacts | null;
  readonly questionCount: number;
};

type CountParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const countOf = ({ count, one, many }: CountParams): string =>
  `${count} ${count === 1 ? one : many}`;

export const planSentenceOf = ({ plan, questionCount }: Params): string => {
  const who = plan === null ? 'The plan' : `Plan v${plan.version}`;
  const questions =
    questionCount > 0
      ? `, and ${countOf({ count: questionCount, one: 'question', many: 'questions' })}`
      : '';
  const head = `${who} waits on your OK${questions}.`;
  if (plan === null || plan.branchCount === 0) {
    return head;
  }
  const branches = countOf({ count: plan.branchCount, one: 'branch', many: 'branches' });
  return `${head} The run covers ${branches}.`;
};
