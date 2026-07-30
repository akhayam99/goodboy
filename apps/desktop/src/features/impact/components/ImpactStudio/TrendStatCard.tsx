import { StatCard, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly current: number;
  readonly previous: number | null;
  readonly lowerIsBetter?: boolean;
  readonly onClick?: () => void;
};

export const TrendStatCard = ({
  label,
  value,
  current,
  previous,
  lowerIsBetter,
  onClick,
}: Props) => {
  const difference = previous === null ? null : current - previous;
  const isPositive = difference !== null && difference > 0;
  const isImprovement = lowerIsBetter === true ? !isPositive : isPositive;
  const hint =
    difference === null
      ? 'all-time'
      : difference === 0
        ? 'no change'
        : `${difference > 0 ? '+' : ''}${difference.toFixed(current % 1 === 0 ? 0 : 1)} vs prior`;
  const card = (
    <StatCard
      label={label}
      value={value}
      hint={hint}
      className={cn(
        'h-full',
        difference !== null && difference !== 0 && isImprovement ? 'border-success/30' : undefined,
      )}
    />
  );
  if (onClick === undefined) {
    return card;
  }
  return (
    <button type="button" onClick={onClick} className="rounded-lg text-left">
      {card}
    </button>
  );
};
