import { Checkbox, ROW_INTERACTIVE, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly isChecked: boolean;
  readonly onChange: (isChecked: boolean) => void;
};

export const FilterCheckRow = ({ label, count, isChecked, onChange }: Props) => (
  <Checkbox
    checked={isChecked}
    onChange={onChange}
    ariaLabel={`${label}, ${count}`}
    className={cn('flex min-h-7 w-full rounded-md pl-1 pr-2', ROW_INTERACTIVE)}
    label={
      <span data-filter-row="" className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            isChecked ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{count}</span>
      </span>
    }
  />
);
