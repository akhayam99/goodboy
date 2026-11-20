import { StatCard, cn, tintClasses } from '@goodboy/ui';
import { NOT_LOADED_HINT } from '../../../../../shared/utils/unknownValue';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly current: number | null;
  readonly previous: number | null;
  readonly lowerIsBetter?: boolean;
  readonly onClick?: () => void;
};

type HintParams = {
  readonly current: number | null;
  readonly difference: number | null;
};

const hintOf = ({ current, difference }: HintParams): string => {
  if (current === null) {
    return NOT_LOADED_HINT;
  }
  if (difference === null) {
    return 'all-time';
  }
  if (difference === 0) {
    return 'no change';
  }
  return `${difference > 0 ? '+' : ''}${difference.toFixed(current % 1 === 0 ? 0 : 1)} vs prior`;
};

export const TrendStatCard = ({
  label,
  value,
  current,
  previous,
  lowerIsBetter,
  onClick,
}: Props) => {
  const difference = previous === null || current === null ? null : current - previous;
  const isPositive = difference !== null && difference > 0;
  const isImprovement = lowerIsBetter === true ? !isPositive : isPositive;
  const card = (
    <StatCard
      label={label}
      value={value}
      hint={hintOf({ current, difference })}
      className={cn(
        'h-full',
        difference !== null && difference !== 0 && isImprovement
          ? cn(tintClasses('success').borderSoft)
          : undefined,
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
