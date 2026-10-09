import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '../cn';
import { ICON_SIZE } from '../iconSize';

export type Props = {
  readonly label: string;
  readonly count: number;
  readonly isShown: boolean;
  readonly icon: LucideIcon;
  readonly onChange: (isShown: boolean) => void;
  readonly isFilter?: boolean;
};

export const CountToggle = ({ label, count, isShown, icon, onChange, isFilter = false }: Props) => {
  if (count === 0) {
    return null;
  }

  const Icon = icon;
  const text = isFilter
    ? `${label} (${count})`
    : `${isShown ? 'Hide' : 'Show'} ${label} (${count})`;

  return (
    <button
      type="button"
      onClick={() => onChange(!isShown)}
      aria-pressed={isShown}
      className={cn(
        'flex h-7 items-center gap-1 rounded-md px-2 text-chip motion-safe:transition-colors',
        isShown
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-hover hover:text-foreground',
      )}
    >
      <Icon size={ICON_SIZE.mark} aria-hidden />
      {text}
      {isFilter && isShown ? <Check size={ICON_SIZE.mark} aria-hidden /> : null}
    </button>
  );
};
