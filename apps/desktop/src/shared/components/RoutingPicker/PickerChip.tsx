import { EyeOff } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CHIP_ACTIVE } from './chipTone';

const HIDDEN_IN_PICKER = 'Hidden in the picker';

type Props = {
  readonly label: string;
  readonly active: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly isHiddenInPicker?: boolean;
  readonly onSelect: () => void;
};

export const PickerChip = ({
  label,
  active,
  disabled = false,
  title,
  isHiddenInPicker = false,
  onSelect,
}: Props) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    title={isHiddenInPicker ? (title ?? HIDDEN_IN_PICKER) : title}
    aria-pressed={active}
    className={cn(
      'inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-label transition-colors',
      active
        ? cn('font-medium shadow-sm', CHIP_ACTIVE)
        : 'text-muted-foreground hover:bg-background hover:text-foreground',
      disabled && 'cursor-not-allowed opacity-60',
    )}
  >
    {isHiddenInPicker ? (
      <EyeOff size={11} aria-label={HIDDEN_IN_PICKER} className="shrink-0" />
    ) : null}
    <span className="truncate">{label}</span>
  </button>
);
