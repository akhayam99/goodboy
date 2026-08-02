import { cn, tintClasses } from '@goodboy/ui';
import { spendTone } from './lib';

type Props = {
  readonly label: string;
  readonly valueLabel: string;
  readonly pct: number;
  readonly icon?: React.ReactNode;
  readonly onClick?: () => void;
};

export const SpendBar = ({ label, valueLabel, pct, icon, onClick }: Props) => {
  const width = `${Math.min(Math.max(pct, 0), 1) * 100}%`;
  const tone = spendTone({ pct });
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate text-sm capitalize text-foreground">
          {icon}
          {label}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {valueLabel}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full motion-safe:transition-all', tintClasses(tone).dot)}
          style={{ width }}
        />
      </div>
    </>
  );

  if (onClick === undefined) {
    return <div className="flex flex-col gap-1.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors',
        'hover:bg-muted/40',
      )}
    >
      {body}
    </button>
  );
};
