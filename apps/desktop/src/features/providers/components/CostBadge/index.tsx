import { cn, formatUsd, Tooltip } from '@goodboy/ui';

export type Props = {
  readonly value: number;
  readonly className?: string;
  readonly title?: string;
};

export const CostBadge = ({ value, className, title }: Props) => (
  <Tooltip content={title}>
    <span className={cn('tabular-nums', className)}>{formatUsd(value)}</span>
  </Tooltip>
);
