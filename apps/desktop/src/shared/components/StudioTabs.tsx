import { cn } from '@goodboy/ui';

export type StudioTab<T extends string> = Readonly<{
  label: string;
  value: T;
}>;

type Props<T extends string> = {
  readonly ariaLabel: string;
  readonly tabs: ReadonlyArray<StudioTab<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
};

export const StudioTabs = <T extends string>({ ariaLabel, tabs, value, onChange }: Props<T>) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className="flex items-center gap-1 rounded-md bg-muted/50 p-1"
  >
    {tabs.map((tab) => {
      const isActive = tab.value === value;
      return (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            isActive
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);
