import type { PlanPrimary } from './planPrimaryOf';

export type UnsentCommentsConfirm = Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
}>;

type Params = Readonly<{
  primary: Pick<PlanPrimary, 'kind'>;
  count: number;
}>;

const VERBS = { approve: 'Approve', run: 'Run' } as const;

const STARTS = { approve: 'The next step starts', run: 'The run starts' } as const;

export const unsentCommentsConfirmOf = ({
  primary,
  count,
}: Params): UnsentCommentsConfirm | null => {
  if (count === 0 || (primary.kind !== 'approve' && primary.kind !== 'run')) {
    return null;
  }
  const verb = VERBS[primary.kind];
  const starts = STARTS[primary.kind];
  const isOne = count === 1;
  return {
    title: isOne ? `${verb} without your comment?` : `${verb} without your ${count} comments?`,
    description: isOne
      ? `${starts} without it. It stays on the plan as Not sent.`
      : `${starts} without them. They stay on the plan as Not sent.`,
    confirmLabel: `${verb} anyway`,
  };
};
