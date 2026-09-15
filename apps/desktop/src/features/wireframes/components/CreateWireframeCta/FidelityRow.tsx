import { cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly hint: string;
  readonly isBusy: boolean;
  readonly isDisabled: boolean;
  readonly onSelect: () => void;
};

export const FidelityRow = ({ label, hint, isBusy, isDisabled, onSelect }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={isDisabled}
    className={cn(
      'flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60',
      isBusy && 'bg-muted/60',
    )}
  >
    <span className="truncate text-xs font-medium text-foreground">
      {isBusy ? `Starting ${label.toLowerCase()}` : label}
    </span>
    <span className="text-2xs leading-relaxed text-muted-foreground">{hint}</span>
  </button>
);
