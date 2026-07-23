import { cn } from '@goodboy/ui';

export type SegmentedOption<T extends string> = Readonly<{
  label: string;
  value: T;
}>;

type Props<T extends string> = {
  readonly ariaLabel: string;
  readonly options: ReadonlyArray<SegmentedOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
};

export const SegmentedControl = <T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: Props<T>) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className="flex items-center gap-1 rounded-md bg-muted/50 p-1"
  >
    {options.map((option) => {
      const isActive = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={isActive}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            isActive
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
