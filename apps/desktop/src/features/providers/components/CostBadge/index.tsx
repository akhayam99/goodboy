import { cn, formatUsd } from '@goodboy/ui';

export interface Props {
  readonly value: number;
  readonly className?: string;
  readonly title?: string;
}

export function CostBadge({ value, className, title }: Props) {
  const formatted = formatUsd(value);
  const split = splitDollarsCents(formatted);
  return (
    <span className={cn('inline-flex items-baseline tabular-nums', className)} title={title}>
      {split ? (
        <>
          <span>{split.dollars}</span>
          <span className="text-[0.78em] opacity-70">{split.cents}</span>
        </>
      ) : (
        <span>{formatted}</span>
      )}
    </span>
  );
}

function splitDollarsCents(formatted: string): { dollars: string; cents: string } | null {
  const m = formatted.match(/^(\$\d+)(\.\d+)$/);
  if (!m) return null;
  return { dollars: m[1]!, cents: m[2]! };
}
