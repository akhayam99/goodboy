import { cn } from '@goodboy/ui';

type Props = {
  readonly isSettled: boolean;
};

export const LeadTreeDot = ({ isSettled }: Props) => (
  <span
    aria-hidden="true"
    data-lead-tree-dot={isSettled ? 'done' : 'working'}
    className={cn('size-2 shrink-0 rounded-full', isSettled ? 'bg-success' : 'bg-info')}
  />
);
