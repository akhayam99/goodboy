import { cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly onSelect: () => void;
};

export const PickerChip = ({ label, active, disabled = false, title, onSelect }: Props) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    className={cn(
      'inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
      active
        ? 'bg-background font-medium text-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      disabled && 'cursor-not-allowed opacity-60',
    )}
  >
    <span className="truncate">{label}</span>
  </button>
);
