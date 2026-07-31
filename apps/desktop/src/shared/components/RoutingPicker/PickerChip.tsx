import { cn } from '@goodboy/ui';
import { CHIP_TONE_ACTIVE, type ChipTone } from './chipTone';

type Props = {
  readonly label: string;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly tone?: ChipTone;
  readonly onSelect: () => void;
};

export const PickerChip = ({
  label,
  active,
  disabled = false,
  title,
  tone = 'neutral',
  onSelect,
}: Props) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    className={cn(
      'inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
      active
        ? cn('font-medium shadow-sm', CHIP_TONE_ACTIVE[tone])
        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      disabled && 'cursor-not-allowed opacity-60',
    )}
  >
    <span className="truncate">{label}</span>
  </button>
);
